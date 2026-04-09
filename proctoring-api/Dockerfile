FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libwebp-dev \
    libopenblas-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install everything except dlib first
RUN pip install --no-cache-dir Flask flask-cors opencv-python-headless numpy ultralytics gunicorn

# Install pre-compiled dlib wheel (no compilation needed)
RUN pip install --no-cache-dir https://github.com/z-mahmud22/Dlib_Windows_Python3.x/releases/download/v19.24.6/dlib-19.24.6-cp310-cp310-linux_x86_64.whl || \
    pip install --no-cache-dir dlib==19.24.2 --only-binary=:all: || \
    pip install --no-cache-dir dlib

COPY . .

EXPOSE 7860

CMD ["gunicorn", "api:app", "--bind", "0.0.0.0:7860", "--workers", "1", "--timeout", "120"]
