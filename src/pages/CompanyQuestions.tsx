import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Send, Copy, Link2, Calendar, User, Clock } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface QuestionItem {
  question: string;
  answer: string;
}

export default function CompanyQuestions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [intervieweeName, setIntervieweeName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState("30");
  const [questions, setQuestions] = useState<QuestionItem[]>([{ question: "", answer: "" }]);
  const [saving, setSaving] = useState(false);
  const [createdSession, setCreatedSession] = useState<{ code: string; id: string; timeLimit: number } | null>(null);

  const addQuestion = () => {
    if (questions.length >= 10) { toast.error("Maximum 10 questions allowed"); return; }
    setQuestions([...questions, { question: "", answer: "" }]);
  };

  const removeQuestion = (index: number) => setQuestions(questions.filter((_, i) => i !== index));

  const updateQuestion = (index: number, field: "question" | "answer", value: string) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const generateSessionCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!title.trim()) { toast.error("Please enter an interview title"); return; }
    if (questions.some((q) => !q.question.trim() || !q.answer.trim())) {
      toast.error("Please fill in all questions and answers"); return;
    }
    const timeLimit = parseInt(timeLimitMinutes) || 30;
    if (timeLimit < 5 || timeLimit > 180) {
      toast.error("Time limit must be between 5 and 180 minutes"); return;
    }

    setSaving(true);
    try {
      const sessionCode = generateSessionCode();
      const { data: interview, error: intError } = await supabase
        .from("interviews" as any)
        .insert({
          title,
          company_user_id: user.id,
          session_code: sessionCode,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          status: "upcoming",
          interviewee_name: intervieweeName.trim() || null,
          time_limit_minutes: timeLimit,
        } as any)
        .select()
        .single();
      if (intError) throw intError;

      const questionRows = questions.map((q, i) => ({
        interview_id: (interview as any).id,
        question_number: i + 1,
        question_text: q.question,
        expected_answer: q.answer,
      }));
      const { error: qError } = await supabase.from("interview_questions" as any).insert(questionRows as any);
      if (qError) throw qError;

      setCreatedSession({ code: sessionCode, id: (interview as any).id, timeLimit });
      toast.success("Interview created successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create interview");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  if (createdSession) {
    const sessionUrl = `${window.location.origin}/join/${createdSession.code}`;
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="mx-auto h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
            <Send className="h-7 w-7 text-success" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Interview Created!</h2>
          <p className="text-muted-foreground">Share the session code or URL with your candidate.</p>
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Session Details</CardTitle>
            <CardDescription>
              {title}{intervieweeName ? ` — ${intervieweeName}` : ""} • {createdSession.timeLimit} min time limit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Session Code</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-md px-4 py-3 font-mono text-2xl font-bold tracking-[0.3em] text-center">
                  {createdSession.code}
                </div>
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(createdSession.code, "Session code")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Session URL</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-md px-3 py-2 text-sm text-muted-foreground font-mono truncate">{sessionUrl}</div>
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(sessionUrl, "Session URL")}>
                  <Link2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Time limit: <strong>{createdSession.timeLimit} minutes</strong></span>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => {
            setCreatedSession(null); setTitle(""); setIntervieweeName(""); setScheduledAt(""); setTimeLimitMinutes("30"); setQuestions([{ question: "", answer: "" }]);
          }}>Create Another</Button>
          <Button className="flex-1" onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Create Interview</h2>
        <p className="text-muted-foreground">Set up questions, schedule, and share a code with candidates.</p>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle>Interview Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Interview Title</label>
            <Input placeholder="e.g., Frontend Developer - React Assessment" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              <User className="h-3.5 w-3.5 inline mr-1" /> Candidate Name <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input placeholder="e.g., Rahul Sharma" value={intervieweeName} onChange={(e) => setIntervieweeName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              <Calendar className="h-3.5 w-3.5 inline mr-1" /> Schedule Date & Time <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              <Clock className="h-3.5 w-3.5 inline mr-1" /> Time Limit <span className="text-muted-foreground font-normal">(minutes)</span>
            </label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="5"
                max="180"
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(e.target.value)}
                className="w-32"
                placeholder="30"
              />
              <div className="flex gap-2">
                {[15, 30, 45, 60, 90].map((min) => (
                  <Button
                    key={min}
                    type="button"
                    variant={timeLimitMinutes === String(min) ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimeLimitMinutes(String(min))}
                    className="text-xs"
                  >
                    {min}m
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Interview auto-submits when time runs out. Min 5, max 180 minutes.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Questions & Expected Answers</CardTitle>
            <CardDescription>{questions.length}/10 questions — answers are hidden from candidates</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={addQuestion} disabled={questions.length >= 10} className="gap-2">
            <Plus className="h-4 w-4" /> Add Question
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.map((q, i) => (
            <div key={i} className="p-4 rounded-lg border space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline">Question {i + 1}</Badge>
                {questions.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeQuestion(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Question</label>
                <Textarea placeholder="Enter your question..." value={q.question} onChange={(e) => updateQuestion(i, "question", e.target.value)} className="resize-none" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  Expected Answer
                  <Badge variant="secondary" className="text-xs font-normal">Hidden from candidates</Badge>
                </label>
                <Textarea placeholder="Enter the expected answer (used for scoring)..." value={q.answer} onChange={(e) => updateQuestion(i, "answer", e.target.value)} className="resize-none" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={saving} className="gap-2">
          {saving ? "Creating..." : "Create Interview"}
          {!saving && <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
