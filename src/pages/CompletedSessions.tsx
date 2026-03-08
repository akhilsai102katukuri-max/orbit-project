import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Star, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Interview {
  id: string;
  title: string;
  session_code: string;
  scheduled_at: string | null;
  created_at: string;
  interviewee_name: string | null;
}

interface ResponseData {
  score: number | null;
  interviewee_name: string | null;
  interviewee_user_id: string;
  feedback: string | null;
  question_id: string;
}

export default function CompletedSessions() {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [responses, setResponses] = useState<ResponseData[]>([]);
  const [questionMap, setQuestionMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: ivData } = await supabase
        .from("interviews" as any)
        .select("*")
        .eq("company_user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      const ivList = (ivData as any[]) || [];
      setInterviews(ivList);

      if (ivList.length > 0) {
        const ids = ivList.map((i: any) => i.id);
        const { data: qData } = await supabase
          .from("interview_questions" as any)
          .select("id, interview_id")
          .in("interview_id", ids);

        const questions = (qData as any[]) || [];
        const qMap: Record<string, string> = {};
        questions.forEach((q: any) => { qMap[q.id] = q.interview_id; });
        setQuestionMap(qMap);

        if (questions.length > 0) {
          const qIds = questions.map((q: any) => q.id);
          const { data: rData } = await supabase
            .from("interviewee_responses" as any)
            .select("score, interviewee_name, interviewee_user_id, feedback, question_id")
            .in("question_id", qIds);
          setResponses((rData as any[]) || []);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const getInterviewResponses = (interviewId: string) => {
    const qIds = Object.entries(questionMap).filter(([_, ivId]) => ivId === interviewId).map(([qId]) => qId);
    return responses.filter((r) => qIds.includes(r.question_id));
  };

  const getAvgScore = (interviewId: string) => {
    const rs = getInterviewResponses(interviewId).filter((r) => r.score !== null);
    if (rs.length === 0) return null;
    return Math.round(rs.reduce((a, b) => a + (b.score || 0), 0) / rs.length);
  };

  const getIntervieweeName = (interviewId: string) => {
    const rs = getInterviewResponses(interviewId);
    return rs[0]?.interviewee_name || "Unknown";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Completed Sessions</h2>
        <p className="text-muted-foreground">All finished interview sessions with results.</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : interviews.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No completed sessions yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {interviews.map((iv) => {
            const avg = getAvgScore(iv.id);
            const name = iv.interviewee_name || getIntervieweeName(iv.id);
            return (
              <Card key={iv.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{iv.title}</CardTitle>
                    <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Candidate: <strong>{name}</strong></span>
                  </div>
                  {avg !== null && (
                    <div className="flex items-center gap-2 text-sm">
                      <Star className="h-4 w-4 text-warning" />
                      <span>Average Score: <strong>{avg}%</strong></span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Completed: {iv.scheduled_at ? new Date(iv.scheduled_at).toLocaleDateString() : new Date(iv.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">Code: {iv.session_code}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
