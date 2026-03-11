"""
Script to download required model files for the cheating detection system.
Run this script to automatically download all necessary model files.
"""

import urllib.request
import os
import sys

def download_file(url, filename):
    """Download a file with progress indication."""
    print(f"\nDownloading {filename}...")
    print(f"URL: {url}")
    
    try:
        def reporthook(count, block_size, total_size):
            percent = int(count * block_size * 100 / total_size)
            sys.stdout.write(f"\rProgress: {percent}% ")
            sys.stdout.flush()
        
        urllib.request.urlretrieve(url, filename, reporthook)
        print(f"\n✓ Successfully downloaded {filename}")
        return True
    except Exception as e:
        print(f"\n✗ Error downloading {filename}: {e}")
        return False

def main():
    print("=" * 70)
    print("Cheating Detection System - Model File Downloader")
    print("=" * 70)
    
    # Define files to download
    files = [
        {
            "url": "https://raw.githubusercontent.com/AlexeyAB/darknet/master/cfg/yolov4.cfg",
            "filename": "yolov4.cfg",
            "size": "~12 KB"
        },
        {
            "url": "https://raw.githubusercontent.com/AlexeyAB/darknet/master/data/coco.names",
            "filename": "coco.names.txt",
            "size": "~1 KB"
        },
        {
            "url": "https://github.com/AlexeyAB/darknet/releases/download/darknet_yolo_v3_optimal/yolov4.weights",
            "filename": "yolov4.weights",
            "size": "~246 MB"
        }
    ]
    
    print("\nThis script will download the following files:")
    for f in files:
        print(f"  - {f['filename']} ({f['size']})")
    
    print("\nNote: shape_predictor_68_face_landmarks.dat.bz2 (99 MB) needs manual download")
    print("      from: http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2")
    print("      Then extract the .bz2 file to get the .dat file")
    
    input("\nPress Enter to start downloading...")
    
    success_count = 0
    for file_info in files:
        if os.path.exists(file_info["filename"]):
            print(f"\n{file_info['filename']} already exists. Skipping...")
            success_count += 1
        else:
            if download_file(file_info["url"], file_info["filename"]):
                success_count += 1
    
    print("\n" + "=" * 70)
    print(f"Download Summary: {success_count}/{len(files)} files ready")
    print("=" * 70)
    
    if success_count == len(files):
        print("\n✓ All automatic downloads completed!")
    else:
        print("\n⚠ Some downloads failed. Please download them manually.")
    
    print("\n⚠ IMPORTANT: Don't forget to manually download:")
    print("   shape_predictor_68_face_landmarks.dat.bz2")
    print("   from: http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2")
    print("   Extract it to get shape_predictor_68_face_landmarks.dat")
    
    print("\nOnce all files are downloaded, run: python app.py")

if __name__ == "__main__":
    main()
