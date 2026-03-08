import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Video, CheckCircle, Clock, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SessionResult {
  interviewId: string;
  interviewTitle: string;
  status: string;
  joinedAt: string;
  questions: { questionText: string; score: number; feedback: string }[];
  avgScore: number | null;
}

export default function IntervieweeSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: pData } = await supabase
        .from("interview_participants" as any)
        .select("interview_id, status, joined_at")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false });

      const participations = (pData as any[]) || [];
      if (participations.length === 0) { setLoading(false); return; }

      const ivIds = participations.map((p: any) => p.interview_id);

      const { data: ivData } = await supabase
        .from("interviews" as any)
        .select("id, title")
        .in("id", ivIds);
      const interviews = (ivData as any[]) || [];

      const { data: qData } = await supabase
        .from("interview_questions" as any)
        .select("id, interview_id, question_text, question_number")
        .in("interview_id", ivIds)
        .order("question_number", { ascending: true });
      const questions = (qData as any[]) || [];
      const qIds = questions.map((q: any) => q.id);

      let responses: any[] = [];
      if (qIds.length > 0) {
        const { data: rData } = await supabase
          .from("interviewee_responses" as any)
          .select("question_id, score, feedback")
          .eq("interviewee_user_id", user.id)
          .in("question_id", qIds);
        responses = (rData as any[]) || [];
      }

      const results: SessionResult[] = participations.map((p: any) => {
        const iv = interviews.find((i: any) => i.id === p.interview_id);
        const ivQuestions = questions.filter((q: any) => q.interview_id === p.interview_id);
        const ivResponses = ivQuestions.map((q: any) => {
          const resp = responses.find((r: any) => r.question_id === q.id);
          return {
            questionText: q.question_text,
            score: resp?.score || 0,
            feedback: resp?.feedback || "",
          };
        });
        const scored = ivResponses.filter((r) => r.score > 0);
        const avg = scored.length > 0 ? Math.round(scored.reduce((a, b) => a + b.score, 0) / scored.length) : null;
        return {
          interviewId: p.interview_id,
          interviewTitle: iv?.title || "Unknown Interview",
          status: p.status,
          joinedAt: p.joined_at,
          questions: ivResponses,
          avgScore: avg,
        };
      });

      setSessions(results);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const completed = sessions.filter((s) => s.status === "completed");
  const active = sessions.filter((s) => s.status === "joined");
  const terminated = sessions.filter((s) => s.status === "terminated");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">My Sessions</h2>
        <p className="text-muted-foreground">View your interview history, scores, and AI feedback.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Sessions</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{loading ? "—" : sessions.length}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Completed</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-success">{loading ? "—" : completed.length}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Score</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "—" : completed.length > 0
                ? Math.round(completed.filter((s) => s.avgScore !== null).reduce((a, b) => a + (b.avgScore || 0), 0) / Math.max(completed.filter((s) => s.avgScore !== null).length, 1)) + "%"
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {active.length > 0 && (
        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-warning" /> Active Sessions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {active.map((s) => (
              <div key={s.interviewId} className="p-4 rounded-lg border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">{s.interviewTitle}</p>
                    <p className="text-xs text-muted-foreground">Joined: {new Date(s.joinedAt).toLocaleString()}</p>
                  </div>
                </div>
                <Badge className="bg-primary/10 text-primary">In Progress</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {terminated.length > 0 && (
        <Card className="border-none shadow-sm border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> Terminated Sessions
            </CardTitle>
            <CardDescription>These sessions were terminated due to proctoring violations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {terminated.map((s) => (
              <div key={s.interviewId} className="p-4 rounded-lg border border-destructive/20 bg-destructive/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-sm">{s.interviewTitle}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.joinedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <Badge className="bg-destructive/10 text-destructive border-destructive/20">Terminated</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-success" /> Completed Sessions</CardTitle>
          <CardDescription>Click to see detailed scores and feedback</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : completed.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No completed sessions yet.</p>
              <p className="text-xs">Join an interview using a session code from the Dashboard.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {completed.map((s) => (
                <div key={s.interviewId}>
                  <button
                    onClick={() => setExpandedId(expandedId === s.interviewId ? null : s.interviewId)}
                    className="w-full p-4 rounded-lg border hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-success" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{s.interviewTitle}</p>
                          <p className="text-xs text-muted-foreground">{new Date(s.joinedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {s.avgScore !== null && (
                        <Badge className={s.avgScore > 70 ? "bg-success/10 text-success" : s.avgScore > 40 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}>
                          <Star className="h-3 w-3 mr-1" /> {s.avgScore}%
                        </Badge>
                      )}
                    </div>
                  </button>
                  {expandedId === s.interviewId && s.questions.length > 0 && (
                    <div className="mt-2 ml-6 space-y-2 animate-fade-in">
                      {s.questions.map((q, i) => (
                        <div key={i} className="p-3 rounded-lg bg-muted/50 space-y-1">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">Q{i + 1}</Badge>
                            <span className="text-xs font-bold">{q.score}%</span>
                          </div>
                          <p className="text-sm">{q.questionText}</p>
                          <p className="text-xs text-muted-foreground">{q.feedback || "No feedback"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
