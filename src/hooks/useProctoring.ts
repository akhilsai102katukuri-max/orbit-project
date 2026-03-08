import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";

interface ProctoringOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  stream: MediaStream | null;
  enabled: boolean;
  onTerminate: () => void;
}

export function useProctoring({ videoRef, stream, enabled, onTerminate }: ProctoringOptions) {
  const [multipleFaces, setMultipleFaces] = useState(false);
  const [multipleVoices, setMultipleVoices] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [supported, setSupported] = useState(true);

  const faceWarningsRef = useRef(0);
  const voiceWarningsRef = useRef(0);
  const terminatedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Sustained loud audio tracking (proxy for multiple voices)
  const loudFramesRef = useRef(0);
  const LOUD_THRESHOLD = 180; // audio level 0-255
  const LOUD_FRAMES_LIMIT = 30; // ~3 seconds of sustained loud audio at 10fps check

  const terminate = useCallback((reason: string) => {
    if (terminatedRef.current) return;
    terminatedRef.current = true;
    toast.error(`🚫 Interview terminated: ${reason}`, { duration: 10000 });
    onTerminate();
  }, [onTerminate]);

  // --- Face Detection ---
  useEffect(() => {
    if (!enabled || !stream || !videoRef.current) return;

    // Check if FaceDetector API is available (Chromium browsers)
    if (!("FaceDetector" in window)) {
      setSupported(false);
      console.warn("FaceDetector API not available. Face proctoring disabled.");
      return;
    }

    const detector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
    
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let active = true;
    let intervalId: ReturnType<typeof setInterval>;

    const detectFaces = async () => {
      if (!active || !videoRef.current || videoRef.current.readyState < 2) return;

      const video = videoRef.current;
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const faces = await detector.detect(canvas);
        const count = faces.length;
        setFaceCount(count);

        if (count > 1) {
          setMultipleFaces(true);
          faceWarningsRef.current += 1;
          
          if (faceWarningsRef.current === 1) {
            toast.warning("⚠️ Multiple faces detected! Only the interviewee should be visible.", { duration: 5000 });
          } else if (faceWarningsRef.current === 3) {
            toast.error("⚠️ Final warning! Multiple faces detected repeatedly.", { duration: 5000 });
          } else if (faceWarningsRef.current >= 5) {
            terminate("Multiple persons detected in camera feed");
          }
        } else {
          setMultipleFaces(false);
          // Slowly decay warnings if back to normal
          if (faceWarningsRef.current > 0 && count <= 1) {
            faceWarningsRef.current = Math.max(0, faceWarningsRef.current - 0.2);
          }
        }
      } catch (err) {
        // FaceDetector can fail on certain frames, ignore
      }
    };

    // Check every 2 seconds
    intervalId = setInterval(detectFaces, 2000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [enabled, stream, videoRef, terminate]);

  // --- Voice / Audio Level Monitoring ---
  useEffect(() => {
    if (!enabled || !stream) return;

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let animId: number;
      let checkCount = 0;

      const checkAudio = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);

        // Calculate average audio level
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
        setAudioLevel(Math.round(avg));

        // Only check every ~100ms (requestAnimationFrame runs at 60fps)
        checkCount++;
        if (checkCount % 6 === 0) {
          if (avg > LOUD_THRESHOLD) {
            loudFramesRef.current += 1;
          } else {
            loudFramesRef.current = Math.max(0, loudFramesRef.current - 1);
          }

          if (loudFramesRef.current >= LOUD_FRAMES_LIMIT) {
            setMultipleVoices(true);
            voiceWarningsRef.current += 1;

            if (voiceWarningsRef.current === 1) {
              toast.warning("⚠️ Unusual audio activity detected. Ensure only you are speaking.", { duration: 5000 });
              loudFramesRef.current = 0; // Reset for next detection window
            } else if (voiceWarningsRef.current >= 3) {
              terminate("Multiple voices or unusual audio activity detected");
            }
          } else {
            setMultipleVoices(false);
          }
        }

        animId = requestAnimationFrame(checkAudio);
      };

      animId = requestAnimationFrame(checkAudio);

      return () => {
        cancelAnimationFrame(animId);
        audioContext.close().catch(() => {});
      };
    } catch (err) {
      console.warn("Audio monitoring failed:", err);
    }
  }, [enabled, stream, terminate]);

  return {
    multipleFaces,
    multipleVoices,
    faceCount,
    audioLevel,
    supported,
  };
}
