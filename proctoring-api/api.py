import sys
print("Starting ORBIT Proctoring API...", flush=True)

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import os
import base64

print("Imports done", flush=True)

app = Flask(__name__)
CORS(app, origins=["http://localhost:8080", "http://localhost:8081"])

# --- Global model variables ---
detector = None
predictor = None
yolo_model = None  # ← was: yolo_net, yolo_classes, yolo_output_layers

def load_models():
    global detector, predictor, yolo_model

    current_dir = os.path.dirname(os.path.abspath(__file__))

    # Load dlib (unchanged)
    try:
        import dlib
        print("Loading dlib face detector...", flush=True)
        detector = dlib.get_frontal_face_detector()

        predictor_path = os.path.join(current_dir, "shape_predictor_68_face_landmarks.dat")
        if os.path.exists(predictor_path):
            predictor = dlib.shape_predictor(predictor_path)
            print("Dlib loaded successfully!", flush=True)
        else:
            print(f"WARNING: shape_predictor not found at {predictor_path}", flush=True)
    except Exception as e:
        print(f"Dlib load error: {e}", flush=True)

    # ── UPGRADED: YOLOv4 → YOLOv11 nano ──────────────────────────────────────
    # Old code needed: yolov4.weights + yolov4.cfg + coco.names.txt (~250 MB)
    # New code needs:  nothing — yolo11n.pt auto-downloads (~6 MB) on first run
    try:
        from ultralytics import YOLO
        print("Loading YOLOv11 nano model...", flush=True)
        yolo_model = YOLO("yolo11n.pt")   # downloads automatically if not cached
        # Warm-up pass so first /analyze call isn't slow
        dummy = np.zeros((240, 320, 3), dtype=np.uint8)
        yolo_model(dummy, verbose=False)
        print("YOLOv11 nano loaded successfully!", flush=True)
    except Exception as e:
        print(f"YOLOv11 load error: {e}", flush=True)
    # ─────────────────────────────────────────────────────────────────────────


# Head pose constants (unchanged)
MODEL_POINTS = np.array([
    (0.0, 0.0, 0.0), (0.0, -330.0, -65.0),
    (-225.0, 170.0, -135.0), (225.0, 170.0, -135.0),
    (-150.0, -150.0, -125.0), (150.0, -150.0, -125.0)
], dtype="double")

YAW_THRESHOLD = 20

def get_head_pose(landmarks, frame_size):
    # Unchanged
    image_points = np.array([
        (landmarks.part(30).x, landmarks.part(30).y),
        (landmarks.part(8).x, landmarks.part(8).y),
        (landmarks.part(36).x, landmarks.part(36).y),
        (landmarks.part(45).x, landmarks.part(45).y),
        (landmarks.part(48).x, landmarks.part(48).y),
        (landmarks.part(54).x, landmarks.part(54).y)
    ], dtype="double")

    focal_length = frame_size[1]
    center = (frame_size[1] / 2, frame_size[0] / 2)
    camera_matrix = np.array([
        [focal_length, 0, center[0]],
        [0, focal_length, center[1]],
        [0, 0, 1]
    ], dtype="double")
    dist_coeffs = np.zeros((4, 1))

    _, rotation_vector, translation_vector = cv2.solvePnP(
        MODEL_POINTS, image_points, camera_matrix, dist_coeffs,
        flags=cv2.SOLVEPNP_ITERATIVE
    )
    rmat, _ = cv2.Rodrigues(rotation_vector)
    proj_matrix = np.hstack((rmat, translation_vector))
    euler_angles = cv2.decomposeProjectionMatrix(proj_matrix, camera_matrix, dist_coeffs)[6]
    return float(euler_angles[0]), float(euler_angles[1])


@app.route('/', methods=['GET'])
def index():
    # Unchanged
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>ORBIT Proctoring API</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #333; }
            .status { padding: 10px; background: #e8f5e9; border-radius: 5px; margin: 20px 0; }
            .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
            code { background: #333; color: #fff; padding: 2px 6px; border-radius: 3px; }
        </style>
    </head>
    <body>
        <h1>🎯 ORBIT Proctoring API</h1>
        <div class="status">
            <strong>Status:</strong> ✅ API is running
        </div>
        <h2>Available Endpoints:</h2>
        <div class="endpoint">
            <strong>GET /health</strong><br>
            Check API health status
        </div>
        <div class="endpoint">
            <strong>POST /analyze</strong><br>
            Analyze video frame for cheating detection<br>
            <small>Expects JSON with base64 encoded frame</small>
        </div>
        <p>For more information, visit <code>/health</code> to check system status.</p>
    </body>
    </html>
    """

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "running",
        "dlib_loaded": detector is not None,
        "yolo_loaded": yolo_model is not None,   # ← updated key name
        "yolo_version": "YOLOv11 nano"            # ← new info field
    })


@app.route('/analyze', methods=['POST'])
def analyze_frame():
    try:
        data = request.json
        image_data = data.get('frame', '')

        if not image_data:
            return jsonify({"violations": [], "face_count": 0})

        # Decode base64 image (unchanged)
        img_bytes = base64.b64decode(image_data.split(',')[1])
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            return jsonify({"violations": [], "face_count": 0})

        frame = cv2.resize(frame, (320, 240))
        height, width, _ = frame.shape
        violations = []
        face_count = 0

        # --- Face Detection + Head Pose (unchanged) ---
        if detector is not None:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = detector(gray)
            face_count = len(faces)

            if face_count == 0:
                violations.append({
                    "type": "no_face",
                    "severity": "high",
                    "message": "No face detected in frame"
                })
            elif face_count > 1:
                violations.append({
                    "type": "multiple_faces",
                    "severity": "high",
                    "message": f"{face_count} faces detected"
                })
            elif face_count == 1 and predictor is not None:
                try:
                    face = faces[0]
                    landmarks = predictor(gray, face)
                    pitch, yaw = get_head_pose(landmarks, (height, width))
                    if yaw > YAW_THRESHOLD:
                        violations.append({
                            "type": "gaze_away",
                            "severity": "medium",
                            "message": "Candidate looking Left"
                        })
                    elif yaw < -YAW_THRESHOLD:
                        violations.append({
                            "type": "gaze_away",
                            "severity": "medium",
                            "message": "Candidate looking Right"
                        })
                except Exception:
                    pass

        # ── UPGRADED: YOLOv4 cv2.dnn → YOLOv11 nano (ultralytics) ───────────
        # What changed:
        #   - Removed: blob creation, net.setInput, net.forward, manual NMS
        #   - Added:   single model() call — NMS is built-in
        #   - Output:  same violation dicts as before, zero logic change
        if yolo_model is not None:
            try:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = yolo_model(rgb_frame, conf=0.5, iou=0.4, verbose=False)[0]

                num_persons = 0
                for box in results.boxes:
                    cls_id = int(box.cls[0])
                    label  = yolo_model.names[cls_id]   # e.g. "cell phone", "person"
                    conf   = float(box.conf[0])

                    if label == "cell phone" and conf > 0.6:
                        violations.append({
                            "type": "phone_detected",
                            "severity": "high",
                            "message": f"Mobile phone detected ({conf:.0%})"
                        })
                    elif label == "person":
                        num_persons += 1
                    elif label in ["book", "laptop"]:
                        violations.append({
                            "type": "prohibited_object",
                            "severity": "medium",
                            "message": f"Prohibited object: {label}"
                        })

                if num_persons > 1:
                    violations.append({
                        "type": "multiple_persons",
                        "severity": "high",
                        "message": f"{num_persons} persons detected"
                    })

            except Exception as e:
                print(f"YOLOv11 detection error: {e}", flush=True)
        # ─────────────────────────────────────────────────────────────────────

        return jsonify({
            "face_count": face_count,
            "violations": violations,
            "status": "ok"
        })

    except Exception as e:
        print(f"Analyze error: {e}", flush=True)
        return jsonify({"violations": [], "face_count": 0, "error": str(e)}), 500


if __name__ == '__main__':
    print("Loading models...", flush=True)
    load_models()
    print("Starting Flask server on port 5000...", flush=True)
    print("Running on http://127.0.0.1:5000", flush=True)
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
