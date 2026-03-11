# Quick Start Guide

## What I've Done So Far:

✅ Installed: Flask, OpenCV, NumPy, psutil, pywin32
✅ Created proper folder structure (templates/, static/)
✅ Moved files to correct locations
✅ Created download script for model files

## What You Need to Do:

### 1. Install dlib (REQUIRED)

**Option A - Install CMake first (Recommended):**
```bash
# Download and install CMake from: https://cmake.org/download/
# Make sure to check "Add CMake to system PATH" during installation
# Then run:
pip install dlib
```

**Option B - Use the download script I created:**
```bash
python download_models.py
```
This will download:
- yolov4.cfg
- yolov4.weights (246 MB - may take a few minutes)
- coco.names.txt

### 2. Download Dlib Face Model (MANUAL)

You MUST manually download this file:
- Go to: http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2
- Download the file (99 MB)
- Extract the .bz2 file (use 7-Zip or WinRAR)
- Place `shape_predictor_68_face_landmarks.dat` in the project folder

### 3. Run the Application

```bash
python app.py
```

Then open: http://127.0.0.1:5000/

## Current File Structure:

```
cheat_detection-main/
├── app.py
├── templates/
│   └── index.html
├── static/
│   ├── style.css
│   ├── warning_light.mp3
│   └── warning_severe.mp3
├── requirements.txt
├── download_models.py
├── SETUP_INSTRUCTIONS.md
└── QUICK_START.md (this file)
```

## Still Need to Download:

❌ shape_predictor_68_face_landmarks.dat (manual download required)
❌ yolov4.weights (run download_models.py)
❌ yolov4.cfg (run download_models.py)
❌ coco.names.txt (run download_models.py)

## Troubleshooting:

**"dlib won't install"**
- Install CMake first: https://cmake.org/download/
- Make sure it's added to PATH
- Restart terminal after installing CMake

**"Model files not found"**
- Run: `python download_models.py`
- Manually download the dlib model from the link above

**"Webcam not working"**
- Close other apps using the webcam
- Check Windows privacy settings for camera access
