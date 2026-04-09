import cv2
import numpy as np
import os
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import mediapipe as mp
from ultralytics import YOLO

# Fix for tokenizer warnings
os.environ["TOKENIZERS_PARALLELISM"] = "false"

app = Flask(__name__)
CORS(app)

# --- MediaPipe Face Detection ---
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=5,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# --- YOLOv11 nano Object Detection ---
yolo_model = None

def load_yolo():
    global yolo_model
    print("Loading YOLOv11 nano model...")
    yolo_model = YOLO("yolo11n.pt")
    print("YOLOv11 nano loaded successfully!")

# --- Sentence Transformer for Answer Evaluation ---
answer_evaluator = None

def load_answer_evaluator():
    global answer_evaluator
    print("Loading Sentence Transformer model...")
    from sentence_transformers import SentenceTransformer
    answer_evaluator = SentenceTransformer('all-MiniLM-L6-v2')
    print("Sentence Transformer loaded successfully!")


# ✅ LOAD MODELS AT STARTUP (IMPORTANT FOR HUGGINGFACE)
try:
    load_answer_evaluator()
except Exception as e:
    print("❌ Failed to load Sentence Transformer:", e)

try:
    load_yolo()
except Exception as e:
    print("❌ Failed to load YOLO:", e)


# --- Head Pose / Gaze ---
YAW_THRESHOLD = 20
PITCH_THRESHOLD = 15
PHONE_DETECTION_CONFIDENCE = 0.5

def get_gaze_direction_mediapipe(face_landmarks, frame_w, frame_h):
    try:
        nose = face_landmarks.landmark[1]
        left_edge = face_landmarks.landmark[234]
        right_edge = face_landmarks.landmark[454]

        nose_x = nose.x
        left_x = left_edge.x
        right_x = right_edge.x

        face_width = right_x - left_x
        if face_width == 0:
            return "Forward", False

        nose_ratio = (nose_x - left_x) / face_width

        gaze_direction = "Forward"
        is_gaze_threat = False

        if nose_ratio < 0.40:
            gaze_direction = "Right"
            is_gaze_threat = True
        elif nose_ratio > 0.60:
            gaze_direction = "Left"
            is_gaze_threat = True

        return gaze_direction, is_gaze_threat
    except Exception:
        return "Unknown", False


# --- Main Analysis Endpoint ---
@app.route('/analyze', methods=['POST'])
def analyze_frame():
    try:
        data = request.json
        image_data = data.get('frame', '')

        if not image_data:
            return jsonify({"error": "No frame provided", "violations": []}), 400

        import base64
        img_bytes = base64.b64decode(image_data.split(',')[1])
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            return jsonify({"error": "Could not decode image", "violations": []}), 400

        frame = cv2.resize(frame, (320, 240))
        height, width, _ = frame.shape

        violations = []
        face_count = 0
        gaze_direction = "Unknown"
        phone_detected = False

        # --- MediaPipe Face Detection ---
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb_frame)

        if results.multi_face_landmarks:
            face_count = len(results.multi_face_landmarks)

            if face_count > 1:
                violations.append({
                    "type": "multiple_faces",
                    "severity": "high",
                    "message": f"{face_count} faces detected in frame"
                })
            else:
                face_landmarks = results.multi_face_landmarks[0]
                gaze_direction, is_gaze_threat = get_gaze_direction_mediapipe(
                    face_landmarks, width, height
                )
                if is_gaze_threat:
                    violations.append({
                        "type": "gaze_away",
                        "severity": "medium",
                        "message": f"Candidate looking {gaze_direction}"
                    })
        else:
            face_count = 0
            violations.append({
                "type": "no_face",
                "severity": "high",
                "message": "No face detected in frame"
            })

        # --- YOLOv11 Object Detection ---
        if yolo_model is not None:
            yolo_results = yolo_model(frame, verbose=False, conf=0.5)
            num_persons = 0

            for result in yolo_results:
                for box in result.boxes:
                    class_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    label = yolo_model.names[class_id]

                    if label == "cell phone" and conf > PHONE_DETECTION_CONFIDENCE:
                        phone_detected = True
                        violations.append({
                            "type": "phone_detected",
                            "severity": "high",
                            "message": f"Mobile phone detected (confidence: {conf:.0%})"
                        })
                    elif label == "person":
                        num_persons += 1
                    elif label in ["book", "laptop", "mouse", "keyboard", "remote"]:
                        violations.append({
                            "type": "prohibited_object",
                            "severity": "medium",
                            "message": f"Prohibited object detected: {label}"
                        })

            if num_persons > 1:
                violations.append({
                    "type": "multiple_persons",
                    "severity": "high",
                    "message": f"{num_persons} persons detected by object detection"
                })

        return jsonify({
            "face_count": face_count,
            "gaze_direction": gaze_direction,
            "phone_detected": phone_detected,
            "violations": violations,
            "status": "ok"
        })

    except Exception as e:
        print(f"Analysis error: {e}")
        return jsonify({"error": str(e), "violations": []}), 500


# --- Answer Evaluation Endpoint ---
@app.route('/evaluate-answer', methods=['POST'])
def evaluate_answer():
    try:
        if answer_evaluator is None:
            return jsonify({"error": "Answer evaluator not loaded yet. Please wait and retry."}), 503

        data = request.json
        candidate_answer = data.get('candidate_answer', '').strip()
        expected_answer = data.get('expected_answer', '').strip()

        if not candidate_answer:
            return jsonify({"error": "candidate_answer is required"}), 400
        if not expected_answer:
            return jsonify({"error": "expected_answer is required"}), 400

        from sklearn.metrics.pairwise import cosine_similarity

        embeddings = answer_evaluator.encode([candidate_answer, expected_answer])
        similarity = float(cosine_similarity([embeddings[0]], [embeddings[1]])[0][0])

        score = round(similarity * 100)

        if score >= 80:
            grade = "Excellent"
            feedback = "Great answer! Your response closely matches the expected answer."
        elif score >= 60:
            grade = "Good"
            feedback = "Good answer. You covered the main points but could add more detail."
        elif score >= 40:
            grade = "Fair"
            feedback = "Partial answer. You touched on some key points but missed important aspects."
        else:
            grade = "Poor"
            feedback = "Your answer didn't align well with the expected response."

        return jsonify({
            "score": score,
            "similarity": round(similarity, 4),
            "grade": grade,
            "feedback": feedback
        })

    except Exception as e:
        print(f"Evaluation error: {e}")
        return jsonify({"error": str(e)}), 500


# --- Health Check ---
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "running",
        "face_detector": "MediaPipe FaceMesh",
        "face_detector_loaded": face_mesh is not None,
        "yolo_loaded": yolo_model is not None,
        "yolo_version": "YOLOv11 nano",
        "answer_evaluator_loaded": answer_evaluator is not None,
        "answer_evaluator_model": "all-MiniLM-L6-v2"
    })