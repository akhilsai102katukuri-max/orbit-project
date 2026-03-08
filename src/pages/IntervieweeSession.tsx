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

function scoreAnswerFallback(expected: string, given: string): number {
  if (!given.trim()) return 0;
  const expectedWords = expected.toLowerCase().split(/\s+/).filter(Boolean);
  const givenWords = given.toLowerCase().split(/\s+/).filter(Boolean);
  if (expectedWords.length === 0) return 100;
  const matches = expectedWords.filter((w) => givenWords.includes(w)).length;
  return Math.min(100, Math.round((matches / expectedWords.length) * 100));
}

async function getAIScores(
  questions: Question[],
  answers: Record<string, string>
): Promise<{ score: number; feedback: string }[]> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return questions.map((q) => ({
      score: scoreAnswerFallback(q.expected_answer, answers[q.id] || ""),
      feedback: "Score based on answer relevance to expected response.",
    }));
  }

  try {
    const prompt = `You are an AI interview evaluator. Score each answer from 0-100 and give brief feedback.\n\n${questions
      .map(
        (q, i) =>
          `Question ${i + 1}: ${q.question_text}\nExpected Answer: ${q.expected_answer}\nCandidate Answer: ${answers[q.id] || "(no answer provided)"}`
      )
      .join("\n\n")}\n\nRespond ONLY with a JSON array like:\n[{"score": 85, "feedback": "Good answer covering key points."}, ...]\n\nOne object per question in the same order.`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1000 },
        }),
      }
    );

    if (!resp.ok) throw new Error(`Gemini error: ${resp.status}`);

    const data = await resp.json();
    const rawText: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const cleaned = rawText?.replace(/```json/gi, "")?.replace(/```/g, "")?.trim();

    if (!cleaned) throw new Error("Empty AI response");

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return questions.map((q) => ({
        score: scoreAnswerFallback(q.expected_answer, answers[q.id] || ""),
        feedback: "Score based on answer relevance to expected response.",
      }));
    }

    if (!Array.isArray(parsed) || parsed.length !== questions.length) throw new Error("AI response length mismatch");

    return questions.map((q, i) => {
      const item = parsed[i] ?? {};
      const score = typeof item.score === "number" ? Math.max(0, Math.min(100, Math.round(item.score))) : scoreAnswerFallback(q.expected_answer, answers[q.id] || "");
      const feedback = typeof item.feedback === "string" && item.feedback.trim().length > 0 ? item.feedback.trim() : "Score based on answer relevance to expected response.";
      return { score, feedback };
    });
  } catch {
    return questions.map((q) => ({
      score: scoreAnswerFallback(q.expected_answer, answers[q.id] || ""),
      feedback: "Score based on answer relevance to expected response.",
    }));
  }
}

async function analyzeFrame(
  videoRef: React.RefObject<HTMLVideoElement>,
  interviewId: string,
  userId: string,
  onViolations: (violations: Violation[]) => void,
  onHighSeverity: () => void
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

    const resp = await fetch("http://localhost:5000/analyze", {
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
    // API not running — silently ignore
  }
}

function VoiceAnswer({ questionId, value, onChange }: { questionId: string; value: string; onChange: (id: string, text: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setSupported(false);
    return () => recognitionRef.current?.stop();
  }, []);

  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Speech recognition not supported. Use Chrome."); return; }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN"; // Indian English for better accuracy
    recognition.maxAlternatives = 3; // get multiple alternatives, pick best
    let finalTranscript = value;

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          // Pick the highest confidence alternative
          let bestTranscript = event.results[i][0].transcript;
          let bestConfidence = event.results[i][0].confidence || 0;
          for (let j = 1; j < event.results[i].length; j++) {
            if ((event.results[i][j].confidence || 0) > bestConfidence) {
              bestConfidence = event.results[i][j].confidence;
              bestTranscript = event.results[i][j].transcript;
            }
          }
          finalTranscript += (finalTranscript ? " " : "") + bestTranscript.trim();
        } else {
          interim = event.results[i][0].transcript;
        }
      }
      onChange(questionId, finalTranscript + (interim ? " " + interim : ""));
    };

    recognition.onerror = (e: any) => {
      if (e.error === "no-speech") {
        // Auto restart on silence
        recognitionRef.current?.start();
      } else if (e.error !== "aborted") {
        toast.error(`Speech error: ${e.error}`);
        setIsRecording(false);
      }
    };
    recognition.onend = () => {
      // Auto restart if still recording (handles Chrome auto-stop)
      if (recognitionRef.current && isRecording) {
        try { recognitionRef.current.start(); } catch {}
      } else {
        setIsRecording(false);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    toast.success("Recording started — speak clearly", { id: "rec-start" });
  };

  const stopRecording = () => { recognitionRef.current?.stop(); setIsRecording(false); toast.success("Recording stopped", { id: "rec-stop" }); };

  if (!supported) return <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">Speech recognition not supported. Use Google Chrome.</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button type="button" variant={isRecording ? "destructive" : "outline"} onClick={isRecording ? stopRecording : startRecording} className={`gap-2 ${isRecording ? "animate-pulse" : ""}`}>
          {isRecording ? <><MicOff className="h-4 w-4" /> Stop Recording</> : <><Mic className="h-4 w-4" /> Start Recording</>}
        </Button>
        {isRecording && <div className="flex items-center gap-1.5 text-sm text-destructive font-medium"><div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />Recording…</div>}
      </div>
      <div className="min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground overflow-y-auto whitespace-pre-wrap">
        {value || <span className="text-muted-foreground">Press "Start Recording" and speak your answer.</span>}
      </div>
      {value && <Button type="button" variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => onChange(questionId, "")}>Clear answer</Button>}
    </div>
  );
}

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const handleProctoringTerminate = useCallback(async () => {
    if (interviewId) {
      await (supabase as any).from("interview_participants")
        .update({ status: "terminated" })
        .eq("interview_id", interviewId)
        .eq("user_id", user?.id);
    }
    cameraStream?.getTracks().forEach((t) => t.stop());
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    navigate("/interviewee");
  }, [interviewId, cameraStream, navigate, user]);

  const handleHighSeverityViolation = useCallback(() => {
    setWarningCount((c) => {
      const next = c + 1;
      if (next >= 3) {
        toast.error("Interview terminated due to proctoring violations.", { duration: 8000 });
        handleProctoringTerminate();
      } else {
        toast.warning(`⚠️ Proctoring violation! Warning ${next}/3`, { duration: 4000 });
      }
      return next;
    });
  }, [handleProctoringTerminate]);

  const { multipleFaces, multipleVoices, faceCount } = useProctoring({
    videoRef, stream: cameraStream, enabled: permissionsGranted, onTerminate: handleProctoringTerminate,
  });

  const enterFullscreen = useCallback(async () => {
    try { await document.documentElement.requestFullscreen(); setIsFullscreen(true); }
    catch { toast.error("Please allow fullscreen for this interview."); }
  }, []);

  useEffect(() => {
    fetch("http://localhost:5000/health")
      .then(r => r.json())
      .then(d => { if (d.status === "running") setApiConnected(true); })
      .catch(() => setApiConnected(false));
  }, []);

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
        handleHighSeverityViolation
      );
    }, 2000);

    return () => clearInterval(interval);
  }, [permissionsGranted, cameraStream, interviewId, user, apiConnected, handleHighSeverityViolation]);

  // Timer countdown — starts after permissions granted AND questions loaded (timeLeft set from DB)
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
  }, [permissionsGranted]);

  const handlePermissionsGranted = useCallback(async (stream: MediaStream) => {
    setCameraStream(stream);
    setPermissionsGranted(true);
    try {
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
    } catch (err) { console.warn("Video recording not supported:", err); }

    if (user && interviewId) {
      const { data: profileData } = await (supabase as any)
        .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const candidateName = profileData?.full_name || user.email || "Unknown";

      await (supabase as any).from("interview_participants").upsert({
        interview_id: interviewId,
        user_id: user.id,
        candidate_name: candidateName,
        candidate_email: user.email,
        status: "joined",
        joined_at: new Date().toISOString(),
      }, { onConflict: "interview_id,user_id" });
    }
    await enterFullscreen();
  }, [enterFullscreen, user, interviewId]);

  useEffect(() => {
    if (!permissionsGranted) return;
    const block = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "x", "a"].includes(e.key.toLowerCase())) {
        e.preventDefault(); toast.warning("Copy/paste is disabled.", { id: "copy-paste" });
      }
      if (e.key === "F11") e.preventDefault();
      if (e.key === "Escape") { e.preventDefault(); enterFullscreen(); }
    };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, [permissionsGranted, enterFullscreen]);

  useEffect(() => {
    if (!permissionsGranted) return;
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        setWarningCount((c) => {
          const next = c + 1;
          toast.warning(`⚠️ Fullscreen exit! Warning ${next}/3`, { duration: 5000 });
          if (next >= 3) { toast.error("Interview terminated.", { duration: 8000 }); navigate("/interviewee"); }
          return next;
        });
        setTimeout(() => enterFullscreen(), 1000);
      } else { setIsFullscreen(true); }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, [permissionsGranted, enterFullscreen, navigate]);

  useEffect(() => {
    if (!permissionsGranted) return;
    const handleVisibility = () => {
      if (document.hidden) {
        if (user && interviewId) {
          (supabase as any).from("proctoring_logs").insert({
            interview_id: interviewId, user_id: user.id,
            event_type: "tab_switch", severity: "medium",
            details: "Candidate switched browser tab",
          });
        }
        setWarningCount((c) => {
          const next = c + 1;
          toast.warning(`⚠️ Tab switch detected! Warning ${next}/3`, { duration: 5000 });
          if (next >= 3) { toast.error("Too many violations. Terminated.", { duration: 8000 }); navigate("/interviewee"); }
          return next;
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [permissionsGranted, navigate, user, interviewId]);

  useEffect(() => {
    if (!permissionsGranted) return;
    const block = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, [permissionsGranted]);

  useEffect(() => {
    if (videoRef.current && cameraStream) videoRef.current.srcObject = cameraStream;
  }, [cameraStream, permissionsGranted]);

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((t) => t.stop());
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [cameraStream]);

  useEffect(() => {
    const fetchQuestions = async () => {
      // Block terminated candidates
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
      const { data: interview } = await (supabase as any).from("interviews").select("title, time_limit_minutes").eq("id", interviewId).single();
      if (interview) {
        setInterviewTitle(interview.title);
        const mins = interview.time_limit_minutes || 30;
        setTimeLeft(mins * 60);
      }
      const { data } = await (supabase as any).from("interview_questions")
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
        .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const userName = profileData?.full_name || user.email || "Unknown";

      toast.info("Evaluating your answers with AI...", { id: "ai-scoring" });
      const aiResults = await getAIScores(questions, answers);

      // Save to interviewee_responses (primary table)
      const { error: respError } = await (supabase as any).from("interviewee_responses").insert(
        questions.map((q, i) => ({
          interview_id: interviewId,
          question_id: q.id,
          user_id: user.id,
          interviewee_user_id: user.id,
          interviewee_name: userName,
          answer_text: answers[q.id] || "",
          score: aiResults[i]?.score ?? 0,
          ai_score: aiResults[i]?.score ?? 0,
          feedback: aiResults[i]?.feedback ?? "",
          ai_feedback: aiResults[i]?.feedback ?? "",
          submitted_at: new Date().toISOString(),
        }))
      );
      if (respError) {
        console.error("Response save error:", JSON.stringify(respError));
        toast.error("Failed to save responses: " + respError.message);
      } else {
        console.log("Responses saved successfully for interview:", interviewId);
      }

      try {
        mediaRecorderRef.current?.stop();
        await new Promise((r) => setTimeout(r, 500));
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const filePath = `${user.id}/${interviewId}_${Date.now()}.webm`;
          await supabase.storage.from("interview-recordings").upload(filePath, blob);
        }
      } catch (uploadErr) { console.warn("Video upload failed:", uploadErr); }

      const finalScore = aiResults.length > 0
        ? Math.round(aiResults.reduce((sum, r) => sum + r.score, 0) / aiResults.length) : 0;

      await (supabase as any).from("interview_participants")
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
      {warningCount > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive font-medium">Warning {warningCount}/3 — {3 - warningCount} remaining before termination.</p>
        </div>
      )}

      {aiViolations.map((v, i) => (
        <div key={i} className={`border rounded-lg p-3 flex items-center gap-2 animate-pulse ${v.severity === "high" ? "bg-destructive/10 border-destructive/30" : "bg-yellow-50 border-yellow-200"}`}>
          <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${v.severity === "high" ? "text-destructive" : "text-yellow-600"}`} />
          <p className={`text-sm font-medium ${v.severity === "high" ? "text-destructive" : "text-yellow-700"}`}>
            ⚠️ AI Detection: {v.message}
          </p>
        </div>
      ))}

      {multipleFaces && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2 animate-pulse">
          <Users className="h-4 w-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive font-medium">⚠️ Multiple persons detected ({faceCount} faces)!</p>
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
            <span>Live Session • Question {currentIndex + 1} of {questions.length}</span>
            <span className={"text-xs px-2 py-0.5 rounded-full font-mono " + (timeLeft < 300 ? "bg-destructive/10 text-destructive animate-pulse" : "bg-muted text-muted-foreground")}>
              ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
            {apiConnected && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">AI Proctoring Active</span>
            )}
          </div>
        </div>
        <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" /> Proctored</Badge>
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
                <Badge className="absolute top-2 right-2 bg-blue-600 text-white text-xs">AI Active</Badge>
              )}
            </div>
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-green-600"><div className="h-1.5 w-1.5 rounded-full bg-green-500" /> Camera Active</div>
                <div className="flex items-center gap-1.5 text-green-600"><div className="h-1.5 w-1.5 rounded-full bg-green-500" /> Mic Active</div>
                <div className={`flex items-center gap-1.5 ${isFullscreen ? "text-green-600" : "text-yellow-600"}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${isFullscreen ? "bg-green-500" : "bg-yellow-500"}`} />
                  {isFullscreen ? "Fullscreen" : "Not Fullscreen"}
                </div>
                <div className={`flex items-center gap-1.5 ${apiConnected ? "text-green-600" : "text-gray-400"}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${apiConnected ? "bg-green-500" : "bg-gray-400"}`} />
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
                <VoiceAnswer questionId={currentQuestion.id} value={answers[currentQuestion.id] || ""} onChange={handleAnswerChange} />
                <div className="flex items-center justify-between">
                  <Button variant="outline" onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0} className="gap-2">
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
