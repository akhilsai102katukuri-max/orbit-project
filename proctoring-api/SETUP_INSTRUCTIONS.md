# Setup Instructions for Cheating Detection System

## Current Status
✅ Flask, OpenCV, NumPy, psutil, pywin32 - INSTALLED
❌ dlib - NOT INSTALLED (requires CMake or Python 3.13 or lower)
❌ Model files - NOT DOWNLOADED

## Step 1: Install dlib

### Option A: Install CMake (Recommended)
1. Download CMake from: https://cmake.org/download/
2. Run the installer and CHECK "Add CMake to system PATH"
3. Restart your terminal/PowerShell
4. Run: `pip install dlib`

### Option B: Use Python 3.13 or lower
If you have issues with Python 3.14, consider using Python 3.13 where pre-built dlib wheels are available.

## Step 2: Download Required Model Files

You need to download these files and place them in the project directory:

### 1. Dlib Face Landmarks Model (99 MB)
- **File**: shape_predictor_68_face_landmarks.dat
- **Download**: http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2
- **Note**: Extract the .bz2 file to get the .dat file

### 2. YOLOv4 Weights (246 MB)
- **File**: yolov4.weights
- **Download**: https://github.com/AlexeyAB/darknet/releases/download/darknet_yolo_v3_optimal/yolov4.weights

### 3. YOLOv4 Config (12 KB)
- **File**: yolov4.cfg
- **Download**: https://raw.githubusercontent.com/AlexeyAB/darknet/master/cfg/yolov4.cfg

### 4. COCO Class Names (1 KB)
- **File**: coco.names.txt
- **Download**: https://raw.githubusercontent.com/AlexeyAB/darknet/master/data/coco.names
- **Note**: Save as `coco.names.txt`

## Step 3: Verify File Structure

Your project folder should look like this:
```
cheat_detection-main/
├── app.py
├── index.html
├── style.css
├── requirements.txt
├── shape_predictor_68_face_landmarks.dat  ← Download this
├── yolov4.weights                          ← Download this
├── yolov4.cfg                              ← Download this
├── coco.names.txt                          ← Download this
├── warning_light.mp3
└── warning_severe.mp3
```

## Step 4: Create templates and static folders

The Flask app expects this structure:
```
cheat_detection-main/
├── templates/
│   └── index.html  ← Move index.html here
└── static/
    ├── style.css   ← Move style.css here
    ├── warning_light.mp3
    └── warning_severe.mp3
```

## Step 5: Run the Application

Once everything is set up:
```bash
python app.py
```

Then open your browser to: http://127.0.0.1:5000/

## Troubleshooting

### If webcam doesn't work:
- Make sure no other application is using the webcam
- Check Windows privacy settings (Camera access)

### If model files are missing:
- The app will show specific error messages about which files are missing
- Double-check file names match exactly (case-sensitive)

### If dlib won't install:
- Make sure CMake is in your PATH: `cmake --version`
- Consider using Python 3.13 or lower
