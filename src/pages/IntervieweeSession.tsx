import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Camera, Mic, MicOff, Monitor, ArrowRight, ArrowLeft, Send, ShieldAlert, Maximize, Users, Volume2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useProctoring } from "@/hooks/useProctoring";

interface Question {
  id: string;
  question_number: number;
  question_text: string;
  expected_answer: string;
}

interface Violation {
  type: string;
  severity: string;
  message: string;
}

function PermissionScreen({ onGranted }: { onGranted: (stream: MediaStream) => void }) {
  const [requesting, setRequesting] = useState(false);
  const requestPermissions = async () => {
    setRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      toast.success("Camera and microphone access granted!");
      onGranted(stream);
    } catch {
      toast.error("Please allow camera and microphone access to proceed.");
    } finally {
      setRequesting(false);
    }
  };
  return (
    <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Camera className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Device Access Required</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            This interview requires full device access. Fullscreen mode and copy/paste will be disabled.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {[
              { icon: Camera, label: "Camera", desc: "Video recording + AI proctoring" },
              { icon: Mic, label: "Microphone", desc: "Voice answers via speech-to-text" },
              { icon: Monitor, label: "Fullscreen Mode", desc: "Exiting fullscreen will trigger a warning" },
              { icon: ShieldAlert, label: "Anti-Cheat AI", desc: "Face, gaze and object detection enabled" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Button onClick={requestPermissions} disabled={requesting} className="w-full gap-2">
            {requesting ? "Requesting..." : "Grant Access & Enter Fullscreen"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// TF-IDF inspired keyword scoring — much fairer than pure word match
function scoreAnswer(expected: string, given: string): number {
  if (!given || !given.trim()) return 0;
  if (!expected || !expected.trim()) return given.trim().length > 0 ? 60 : 0;

  const stopwords = new Set([
    "a","an","the","is","are","was","were","be","been","being","have","has","had",
    "do","does","did","will","would","could","should","may","might","shall","can",
    "to","of","in","for","on","with","at","by","from","and","or","but","if","as",
    "it","its","this","that","these","those","i","you","he","she","we","they",
    "what","which","who","how","when","where","why","not","no","yes","so","very",
    "just","also","than","then","there","here","more","some","any","all","each",
    "about","into","through","during","before","after","above","below","between",
  ]);

  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stopwords.has(w));

  const expectedKeywords = normalize(expected);
  const givenWords = normalize(given);

  if (expectedKeywords.length === 0) return givenWords.length > 3 ? 70 : 40;

  const givenSet = new Set(givenWords);

  // Exact matches
  let exactMatches = 0;
  for (const kw of expectedKeywords) {
    if (givenSet.has(kw)) exactMatches++;
  }

  // Stem/partial matches — 70% prefix overlap counts as match
  let partialMatches = 0;
  for (const kw of expectedKeywords) {
    if (givenSet.has(kw)) continue;
    for (const gw of givenWords) {
      const minLen = Math.min(kw.length, gw.length);
      if (minLen < 3) continue;
      const prefixLen = Math.ceil(minLen * 0.7);
      if (kw.slice(0, prefixLen) === gw.slice(0, prefixLen)) {
        partialMatches++;
        break;
      }
    }
  }

  // Synonym/concept pairs — boost score when candidate uses equivalent terms
  const synonymPairs: [string, string][] = [
    ["object","oop"],["oriented","class"],["inheritance","extend"],
    ["polymorphism","override"],["encapsulation","private"],
    ["abstraction","abstract"],["function","method"],["array","list"],
    ["loop","iterate"],["variable","store"],["memory","ram"],
    ["database","db"],["sql","query"],["server","backend"],
    ["client","frontend"],["network","internet"],["protocol","http"],
    ["class","object"],["compile","build"],["runtime","execute"],
  ];
  let synonymBonus = 0;
  for (const [a, b] of synonymPairs) {
    const expHas = expectedKeywords.includes(a) || expectedKeywords.includes(b);
    const givHas = givenSet.has(a) || givenSet.has(b);
    if (expHas && givHas) synonymBonus += 0.5;
  }

  // Length/detail bonus — longer detailed answer gets up to 15 bonus points
  const lengthBonus = Math.min(15, givenWords.length * 0.8);

  // Base: exact + partial weighted, scaled to 85
  const matchRatio = (exactMatches + partialMatches * 0.7 + synonymBonus) / expectedKeywords.length;
  const baseScore = matchRatio * 85;

  return Math.min(100, Math.round(baseScore + lengthBonus));
}

function getScores(
  questions: Question[],
  answers: Record<string, string>
): { score: number; feedback: string }[] {
  return questions.map((q) => {
    const given = (answers[q.id] || "").trim();
    const score = scoreAnswer(q.expected_answer, given);
    let feedback = "Score based on keyword relevance to expected response.";
    if (!given) feedback = "No answer provided.";
    else if (score >= 85) feedback = "Excellent — covered all key concepts.";
    else if (score >= 65) feedback = "Good answer, covered most key points.";
    else if (score >= 40) feedback = "Partial answer — some key concepts missing.";
    else if (score > 0) feedback = "Answer lacks key concepts from expected response.";
    else feedback = "Answer does not match expected response.";
    return { score, feedback };
  });
}

async function analyzeFrame(
  videoRef: React.RefObject<HTMLVideoElement>,
  interviewId: string,
  userId: string,
  onViolations: (violations: Violation[]) => void,
  onHighSeverity: () => void,
  onGazeAway: () => void
): Promise<void> {
  try {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const frameData = canvas.toDataURL("image/jpeg", 0.5);

    const resp = await fetch("https://akhilsai-328-orbit-proctoring-api.hf.space/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frame: frameData }),
    });

    if (!resp.ok) return;
    const result = await resp.json();

    if (result.violations && result.violations.length > 0) {
      onViolations(result.violations);
      for (const v of result.violations) {
        if (v.severity === "high") onHighSeverity();
        if (v.type === "gaze_away") onGazeAway();
        await (supabase as any).from("proctoring_logs").insert({
          interview_id: interviewId,
          user_id: userId,
          event_type: v.type,
          severity: v.severity,
          details: v.message,
        });
      }
    }
  } catch {
    // API offline — silently ignore
  }
}

// ─── VoiceAnswer ──────────────────────────────────────────────────────────────
// FIX: uses a ref-based accumulator to prevent duplicate/stale transcript issues.
// Speech recognition interim results are shown live but NOT appended to the
// stored answer — only final results are appended, each segment exactly once.
function VoiceAnswer({
  questionId,
  value,
  onChange,
}: {
  questionId: string;
  value: string;
  onChange: (id: string, text: string) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  // Accumulates only final segments — never re-reads `value` from closure
  const finalAccRef = useRef<string>("");

  // Keep accumulator in sync when question changes (user navigates away)
  useEffect(() => {
    // Stop any ongoing recording when question changes
    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      recognitionRef.current?.stop();
      setIsRecording(false);
    }
    finalAccRef.current = value ?? "";
    setInterimText("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setSupported(false);
    return () => {
      isRecordingRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  const startRecording = () => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Speech recognition not supported. Use Chrome.");
      return;
    }

    // Sync accumulator with current saved value before starting
    finalAccRef.current = value ?? "";

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          // Pick highest-confidence alternative
          let best = event.results[i][0].transcript;
          let bestConf = event.results[i][0].confidence ?? 0;
          for (let j = 1; j < event.results[i].length; j++) {
            const conf = event.results[i][j].confidence ?? 0;
            if (conf > bestConf) {
              bestConf = conf;
              best = event.results[i][j].transcript;
            }
          }
          const segment = best.trim();
          if (segment) {
            // Append to accumulator — no stale closure, no duplication
            finalAccRef.current = finalAccRef.current
              ? finalAccRef.current + " " + segment
              : segment;
            onChange(questionId, finalAccRef.current);
          }
          interim = "";
        } else {
          interim = event.results[i][0].transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (e: any) => {
      if (e.error === "no-speech") {
        if (isRecordingRef.current) {
          try {
            recognitionRef.current?.start();
          } catch {}
        }
      } else if (e.error !== "aborted") {
        toast.error(`Speech error: ${e.error}`);
        setIsRecording(false);
        isRecordingRef.current = false;
        setInterimText("");
      }
    };

    recognition.onend = () => {
      setInterimText("");
      if (isRecordingRef.current) {
        try {
          recognitionRef.current.start();
        } catch {}
      } else {
        setIsRecording(false);
      }
    };

    recognitionRef.current = recognition;
    isRecordingRef.current = true;
    recognition.start();
    setIsRecording(true);
    toast.success("Recording started — speak clearly", { id: "rec-start" });
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    recognitionRef.current?.stop();
    setIsRecording(false);
    setInterimText("");
    toast.success("Recording stopped", { id: "rec-stop" });
  };

  const clearAnswer = () => {
    finalAccRef.current = "";
    onChange(questionId, "");
    setInterimText("");
  };

  if (!supported)
    return (
      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
        Speech recognition not supported. Please use Google Chrome.
      </div>
    );

  // What we display: saved final text + live interim (interim shown in a lighter style)
  const displayText = value || "";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant={isRecording ? "destructive" : "outline"}
          onClick={isRecording ? stopRecording : startRecording}
          className={`gap-2 ${isRecording ? "animate-pulse" : ""}`}
        >
          {isRecording ? (
            <>
              <MicOff className="h-4 w-4" /> Stop Recording
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" /> Start Recording
            </>
          )}
        </Button>
        {isRecording && (
          <div className="flex items-center gap-1.5 text-sm text-destructive font-medium">
            <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            Recording…
          </div>
        )}
      </div>

      <div className="min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground overflow-y-auto whitespace-pre-wrap">
        {displayText ? (
          <>
            <span>{displayText}</span>
            {interimText && (
              <span className="text-muted-foreground italic"> {interimText}</span>
            )}
          </>
        ) : interimText ? (
          <span className="text-muted-foreground italic">{interimText}</span>
        ) : (
          <span className="text-muted-foreground">
            Press "Start Recording" and speak your answer.
          </span>
        )}
      </div>

      {displayText && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground text-xs"
          onClick={clearAnswer}
        >
          Clear answer
        </Button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function IntervieweeSession() {
  const { interviewId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<HTMLDivElement>(null);

  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [interviewTitle, setInterviewTitle] = useState("");
  const [warningCount, setWarningCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aiViolations, setAiViolations] = useState<Violation[]>([]);
  const [apiConnected, setApiConnected] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(30 * 60);

  // Use a ref for warningCount so callbacks always see fresh value
  const warningCountRef = useRef(0);
  const terminatedRef = useRef(false); // prevent double-terminate

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Gaze counter: every 3 gaze_away detections = 1 warning
  const gazeCountRef = useRef(0);

  // ── Fullscreen helper ──
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false);

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
      setShowFullscreenOverlay(false);
    } catch {
      toast.error("Please allow fullscreen for this interview.");
    }
  }, []);

  // ── Terminate session (mark DB + save recording + stop everything) ──
  const terminateSession = useCallback(
    async (reason: string) => {
      if (terminatedRef.current) return;
      terminatedRef.current = true;

      // Mark as terminated in DB so the candidate cannot rejoin
      if (interviewId && user?.id) {
        await (supabase as any)
          .from("interview_participants")
          .update({ status: "terminated" })
          .eq("interview_id", interviewId)
          .eq("user_id", user.id);
      }

      // Save recording even on termination
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
          await new Promise((r) => setTimeout(r, 800));
        }
        if (recordedChunksRef.current.length > 0 && user?.id && interviewId) {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const filePath = `${user.id}/${interviewId}_${Date.now()}.webm`;
          await supabase.storage.from("interview-recordings").upload(filePath, blob);
        }
      } catch (uploadErr) {
        console.warn("Recording upload on termination failed:", uploadErr);
      }

      toast.error(reason, { duration: 8000 });
      cameraStream?.getTracks().forEach((t) => t.stop());
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      navigate("/interviewee");
    },
    [interviewId, user, cameraStream, navigate]
  );

  // ── Add a warning; terminate immediately if count reaches 3 ──
  const addWarning = useCallback(
    (message: string) => {
      if (terminatedRef.current) return;
      const next = warningCountRef.current + 1;
      warningCountRef.current = next;
      setWarningCount(next);

      if (next >= 3) {
        // Terminate immediately — don't wait for state re-render
        terminateSession("Interview terminated due to repeated violations.");
      } else {
        toast.warning(`⚠️ ${message} Warning ${next}/3`, { duration: 5000 });
      }
    },
    [terminateSession]
  );

  // ── High severity AI violation ──
  const handleHighSeverityViolation = useCallback(() => {
    addWarning("Proctoring violation detected!");
  }, [addWarning]);

  // ── Gaze away — 3 detections = 1 warning ──
  const handleGazeAway = useCallback(() => {
    gazeCountRef.current += 1;
    if (gazeCountRef.current >= 3) {
      gazeCountRef.current = 0;
      addWarning("Looking away from screen too often.");
    }
  }, [addWarning]);

  const { multipleFaces, multipleVoices, faceCount } = useProctoring({
    videoRef,
    stream: cameraStream,
    enabled: permissionsGranted,
    onTerminate: () => terminateSession("Interview terminated due to proctoring violations."),
  });

  // ── Health check ──
  useEffect(() => {
    fetch("https://akhilsai-328-orbit-proctoring-api.hf.space/health")
      .then((r) => r.json())
      .then((d) => { if (d.status === "running") setApiConnected(true); })
      .catch(() => setApiConnected(false));
  }, []);

  // ── Frame analysis loop ──
  useEffect(() => {
    if (!permissionsGranted || !cameraStream || !interviewId || !user) return;
    if (!apiConnected) return;

    const interval = setInterval(() => {
      analyzeFrame(
        videoRef,
        interviewId,
        user.id,
        (violations) => {
          setAiViolations(violations);
          setTimeout(() => setAiViolations([]), 8000);
        },
        handleHighSeverityViolation,
        handleGazeAway
      );
    }, 2000);

    return () => clearInterval(interval);
  }, [permissionsGranted, cameraStream, interviewId, user, apiConnected, handleHighSeverityViolation, handleGazeAway]);

  // ── Timer ──
  useEffect(() => {
    if (!permissionsGranted || timeLeft === 0) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          toast.warning("Time is up! Auto-submitting your interview...");
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsGranted]);

  // ── Permissions granted handler ──
  const handlePermissionsGranted = useCallback(
    async (stream: MediaStream) => {
      setCameraStream(stream);
      setPermissionsGranted(true);

      try {
        const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.warn("Video recording not supported:", err);
      }

      if (user && interviewId) {
        const { data: profileData } = await (supabase as any)
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        const candidateName = profileData?.full_name || user.email || "Unknown";

        await (supabase as any).from("interview_participants").upsert(
          {
            interview_id: interviewId,
            user_id: user.id,
            candidate_name: candidateName,
            candidate_email: user.email,
            status: "joined",
            joined_at: new Date().toISOString(),
          },
          { onConflict: "interview_id,user_id" }
        );
      }
      await enterFullscreen();
    },
    [enterFullscreen, user, interviewId]
  );

  // ── Block copy/paste/F11; Escape key → re-enter fullscreen ──
  useEffect(() => {
    if (!permissionsGranted) return;
    const block = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "x", "a"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        toast.warning("Copy/paste is disabled.", { id: "copy-paste" });
      }
      if (e.key === "F11") e.preventDefault();
      // Escape: browser will exit fullscreen before this fires, so we handle
      // it in fullscreenchange below. Just prevent default here.
      if (e.key === "Escape") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, [permissionsGranted]);

  // ── Fullscreen exit → add warning + auto-return ──
  useEffect(() => {
    if (!permissionsGranted) return;

    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        // Add the warning (will terminate at 3)
        addWarning("Fullscreen exit detected!");
        // Show fullscreen overlay immediately — user must click to re-enter
        // (browsers require a direct user gesture to call requestFullscreen)
        if (!terminatedRef.current) {
          setShowFullscreenOverlay(true);
        }
      } else {
        setIsFullscreen(true);
        setShowFullscreenOverlay(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, [permissionsGranted, enterFullscreen, addWarning]);

  // ── Tab switch detection ──
  useEffect(() => {
    if (!permissionsGranted) return;
    const handleVisibility = () => {
      if (document.hidden) {
        if (user && interviewId) {
          (supabase as any).from("proctoring_logs").insert({
            interview_id: interviewId,
            user_id: user.id,
            event_type: "tab_switch",
            severity: "medium",
            details: "Candidate switched browser tab",
          });
        }
        addWarning("Tab switch detected!");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [permissionsGranted, user, interviewId, addWarning]);

  // ── Block right-click ──
  useEffect(() => {
    if (!permissionsGranted) return;
    const block = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, [permissionsGranted]);

  // ── Attach camera stream to video element ──
  useEffect(() => {
    if (videoRef.current && cameraStream) videoRef.current.srcObject = cameraStream;
  }, [cameraStream, permissionsGranted]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((t) => t.stop());
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [cameraStream]);

  // ── Load questions + check if already terminated/completed ──
  useEffect(() => {
    const fetchQuestions = async () => {
      if (user) {
        const { data: participant } = await (supabase as any)
          .from("interview_participants")
          .select("status")
          .eq("interview_id", interviewId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (participant?.status === "terminated") {
          toast.error("You have been terminated from this interview and cannot rejoin.");
          navigate("/interviewee");
          return;
        }
        if (participant?.status === "completed") {
          toast.error("You have already completed this interview.");
          navigate("/interviewee");
          return;
        }
      }

      const { data: interview } = await (supabase as any)
        .from("interviews")
        .select("title, time_limit_minutes")
        .eq("id", interviewId)
        .single();

      if (interview) {
        setInterviewTitle(interview.title);
        setTimeLeft((interview.time_limit_minutes || 30) * 60);
      }

      const { data } = await (supabase as any)
        .from("interview_questions")
        .select("id, question_number, question_text, expected_answer")
        .eq("interview_id", interviewId)
        .order("question_number", { ascending: true });

      if (data) setQuestions(data);
    };

    if (interviewId) fetchQuestions();
  }, [interviewId, user, navigate]);

  const handleAnswerChange = (questionId: string, text: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { data: profileData } = await (supabase as any)
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const userName = profileData?.full_name || user.email || "Unknown";

      toast.info("Evaluating your answers...", { id: "ai-scoring" });
      const results = getScores(questions, answers);

      const { error: respError } = await (supabase as any)
        .from("interviewee_responses")
        .insert(
          questions.map((q, i) => ({
            interview_id: interviewId,
            question_id: q.id,
            user_id: user.id,
            interviewee_user_id: user.id,
            interviewee_name: userName,
            answer_text: (answers[q.id] || "").trim(),
            score: results[i]?.score ?? 0,
            ai_score: results[i]?.score ?? 0,
            feedback: results[i]?.feedback ?? "",
            ai_feedback: results[i]?.feedback ?? "",
            submitted_at: new Date().toISOString(),
          }))
        );

      if (respError) {
        console.error("Response save error:", JSON.stringify(respError));
        toast.error("Failed to save responses: " + respError.message);
      }

      try {
        mediaRecorderRef.current?.stop();
        await new Promise((r) => setTimeout(r, 500));
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const filePath = `${user.id}/${interviewId}_${Date.now()}.webm`;
          await supabase.storage.from("interview-recordings").upload(filePath, blob);
        }
      } catch (uploadErr) {
        console.warn("Video upload failed:", uploadErr);
      }

      const finalScore =
        results.length > 0
          ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
          : 0;

      await (supabase as any)
        .from("interview_participants")
        .update({ status: "completed", final_score: finalScore })
        .eq("interview_id", interviewId)
        .eq("user_id", user.id);

      toast.success("Interview submitted successfully!");
      cameraStream?.getTracks().forEach((t) => t.stop());
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      navigate("/interviewee");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  if (!permissionsGranted) return <PermissionScreen onGranted={handlePermissionsGranted} />;



  return (
    <div ref={sessionRef} className="space-y-4 animate-fade-in select-none">
      {/* Fullscreen overlay — fixed position so camera/video keeps running underneath */}
      {showFullscreenOverlay && !terminatedRef.current && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 9999, background: "rgba(0,0,0,0.96)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "24px",
          }}
        >
          <ShieldAlert style={{ width: 64, height: 64, color: "#f87171" }} />
          <h2 style={{ fontSize: 28, fontWeight: 700, color: "#f87171", margin: 0 }}>
            ⚠️ Fullscreen Exited!
          </h2>
          <p style={{ fontSize: 18, color: "#d1d5db", margin: 0 }}>
            Warning {warningCount}/3 — You must return to fullscreen to continue.
          </p>
          <p style={{ fontSize: 14, color: "#9ca3af", margin: 0 }}>
            Exiting fullscreen 3 times will permanently terminate your interview.
          </p>
          <button
            onClick={enterFullscreen}
            style={{
              marginTop: 8, padding: "14px 36px", fontSize: 18, fontWeight: 600,
              background: "#ef4444", color: "white", border: "none",
              borderRadius: 8, cursor: "pointer", display: "flex",
              alignItems: "center", gap: 10,
            }}
          >
            <Maximize style={{ width: 20, height: 20 }} />
            Return to Fullscreen
          </button>
        </div>
      )}
      {warningCount > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive font-medium">
            Warning {warningCount}/3 — {3 - warningCount} remaining before termination.
          </p>
        </div>
      )}

      {aiViolations.map((v, i) => (
        <div
          key={i}
          className={`border rounded-lg p-3 flex items-center gap-2 animate-pulse ${
            v.severity === "high"
              ? "bg-destructive/10 border-destructive/30"
              : "bg-yellow-50 border-yellow-200"
          }`}
        >
          <AlertTriangle
            className={`h-4 w-4 flex-shrink-0 ${
              v.severity === "high" ? "text-destructive" : "text-yellow-600"
            }`}
          />
          <p
            className={`text-sm font-medium ${
              v.severity === "high" ? "text-destructive" : "text-yellow-700"
            }`}
          >
            ⚠️ AI Detection: {v.message}
          </p>
        </div>
      ))}

      {multipleFaces && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2 animate-pulse">
          <Users className="h-4 w-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive font-medium">
            ⚠️ Multiple persons detected ({faceCount} faces)!
          </p>
        </div>
      )}
      {multipleVoices && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2 animate-pulse">
          <Volume2 className="h-4 w-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive font-medium">⚠️ Unusual audio activity detected!</p>
        </div>
      )}

      {!isFullscreen && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Maximize className="h-4 w-4 text-yellow-600 flex-shrink-0" />
            <p className="text-sm text-yellow-700 font-medium">You are not in fullscreen mode.</p>
          </div>
          <Button variant="outline" size="sm" onClick={enterFullscreen} className="gap-1">
            <Maximize className="h-3 w-3" /> Enter Fullscreen
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{interviewTitle || "Interview Session"}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span>
              Live Session • Question {currentIndex + 1} of {questions.length}
            </span>
            <span
              className={
                "text-xs px-2 py-0.5 rounded-full font-mono " +
                (timeLeft < 300
                  ? "bg-destructive/10 text-destructive animate-pulse"
                  : "bg-muted text-muted-foreground")
              }
            >
              ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </span>
            {apiConnected && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                AI Proctoring Active
              </span>
            )}
          </div>
        </div>
        <Badge variant="destructive" className="gap-1">
          <ShieldAlert className="h-3 w-3" /> Proctored
        </Badge>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <Card className="overflow-hidden border-none shadow-sm">
            <div className="aspect-video bg-foreground/5 relative rounded-t-lg overflow-hidden">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <Badge className="absolute top-2 left-2 bg-green-600 text-white text-xs gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Recording
              </Badge>
              {apiConnected && (
                <Badge className="absolute top-2 right-2 bg-blue-600 text-white text-xs">
                  AI Active
                </Badge>
              )}
            </div>
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-green-600">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" /> Camera Active
                </div>
                <div className="flex items-center gap-1.5 text-green-600">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" /> Mic Active
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    isFullscreen ? "text-green-600" : "text-yellow-600"
                  }`}
                >
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      isFullscreen ? "bg-green-500" : "bg-yellow-500"
                    }`}
                  />
                  {isFullscreen ? "Fullscreen" : "Not Fullscreen"}
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    apiConnected ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      apiConnected ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  {apiConnected ? "AI Proctored" : "AI Offline"}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {currentQuestion ? (
            <Card className="border-none shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">Q{currentQuestion.question_number}</Badge>
                </div>
                <CardTitle className="text-lg">{currentQuestion.question_text}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <VoiceAnswer
                  questionId={currentQuestion.id}
                  value={answers[currentQuestion.id] || ""}
                  onChange={handleAnswerChange}
                />
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    disabled={currentIndex === 0}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" /> Previous
                  </Button>
                  {currentIndex < questions.length - 1 ? (
                    <Button onClick={() => setCurrentIndex((i) => i + 1)} className="gap-2">
                      Next <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                      <Send className="h-4 w-4" />
                      {submitting ? "Submitting..." : "Submit Interview"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-none shadow-sm p-8 text-center">
              <p className="text-muted-foreground">No questions available for this interview.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
