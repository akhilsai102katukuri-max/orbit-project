import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { User, Star, ArrowLeft, ChevronRight, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface InterviewResult {
  interviewId: string;
  interviewTitle: string;
  intervieweeName: string;
  intervieweeUserId: string;
  questions: { questionText: string; candidateAnswer: string; score: number; feedback: string }[];
  avgScore: number;
  completedAt: string;
}

export default function Analytics() {
  const { user } = useAuth();
  const [results, setResults] = useState<InterviewResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<InterviewResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      // Get ALL company interviews (not just status=completed)
      const { data: ivData } = await supabase
        .from("interviews" as any)
        .select("id, title, created_at")
        .eq("company_user_id", user.id);

      const ivList = (ivData as any[]) || [];
      if (ivList.length === 0) { setLoading(false); return; }

      const ivIds = ivList.map((i: any) => i.id);

      const { data: qData } = await supabase
        .from("interview_questions" as any)
        .select("id, interview_id, question_text, question_number")
        .in("interview_id", ivIds)
        .order("question_number", { ascending: true });

      const questions = (qData as any[]) || [];
      const qIds = questions.map((q: any) => q.id);
      if (qIds.length === 0) { setLoading(false); return; }

      const { data: rData } = await supabase
        .from("interviewee_responses" as any)
        .select("interview_id, question_id, score, feedback, answer_text, interviewee_name, interviewee_user_id, submitted_at")
        .in("question_id", qIds)
        .not("interviewee_user_id", "is", null);

      const responses = (rData as any[]) || [];

      const resultMap = new Map<string, InterviewResult>();
      for (const r of responses) {
        const q = questions.find((qq: any) => qq.id === r.question_id);
        if (!q) continue;
        const iv = ivList.find((i: any) => i.id === q.interview_id);
        if (!iv) continue;
        const key = `${iv.id}_${r.interviewee_user_id}`;
        if (!resultMap.has(key)) {
          resultMap.set(key, {
            interviewId: iv.id,
            interviewTitle: iv.title,
            intervieweeName: r.interviewee_name || "Unknown",
            intervieweeUserId: r.interviewee_user_id,
            questions: [],
            avgScore: 0,
            completedAt: r.submitted_at,
          });
        }
        resultMap.get(key)!.questions.push({
          questionText: q.question_text,
          candidateAnswer: r.answer_text || "No answer provided",
          score: r.score || 0,
          feedback: r.feedback || "",
        });
      }

      const finalResults = Array.from(resultMap.values()).map((r) => ({
        ...r,
        avgScore: r.questions.length > 0
          ? Math.round(r.questions.reduce((a, b) => a + b.score, 0) / r.questions.length)
          : 0,
      })).sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

      setResults(finalResults);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const downloadPDF = (result: InterviewResult) => {
    const lines: string[] = [];
    lines.push("ORBIT - Interview Score Report");
    lines.push("================================");
    lines.push("");
    lines.push("Candidate: " + result.intervieweeName);
    lines.push("Interview: " + result.interviewTitle);
    lines.push("Date: " + new Date(result.completedAt).toLocaleDateString());
    lines.push("Overall Score: " + result.avgScore + "%");
    lines.push("");
    lines.push("QUESTION BREAKDOWN");
    lines.push("------------------");
    result.questions.forEach((q, i) => {
      lines.push("");
      lines.push("Q" + (i + 1) + ": " + q.questionText);
      lines.push("Score: " + q.score + "%");
      lines.push("Feedback: " + (q.feedback || "No feedback"));
    });
    const text = lines.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.intervieweeName + "_report.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (selectedResult) {
    const chartData = selectedResult.questions.map((q, i) => ({
      name: `Q${i + 1}`,
      score: q.score,
      fullMark: 100,
    }));

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedResult(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{selectedResult.intervieweeName}'s Performance</h2>
            <p className="text-muted-foreground text-sm">{selectedResult.interviewTitle}</p>
          </div>
          <Button variant="outline" className="gap-2 ml-auto" onClick={() => downloadPDF(selectedResult)}>
            <Download className="h-4 w-4" /> Download Report
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Average Score</CardTitle></CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${selectedResult.avgScore > 70 ? "text-success" : selectedResult.avgScore > 40 ? "text-warning" : "text-destructive"}`}>
                {selectedResult.avgScore}%
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Questions Answered</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{selectedResult.questions.length}</div></CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Completed</CardTitle></CardHeader>
            <CardContent><div className="text-lg font-medium">{new Date(selectedResult.completedAt).toLocaleDateString()}</div></CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Score per Question</CardTitle>
              <CardDescription>Performance breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="score" fill="hsl(226, 71%, 51%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Skill Radar</CardTitle>
              <CardDescription>Visual performance profile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={chartData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" />
                    <PolarRadiusAxis domain={[0, 100]} />
                    <Radar name="Score" dataKey="score" stroke="hsl(226, 71%, 51%)" fill="hsl(226, 71%, 51%)" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle>Detailed Feedback</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {selectedResult.questions.map((q, i) => (
              <div key={i} className="p-4 rounded-lg border space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Question {i + 1}</Badge>
                  <Badge className={q.score > 70 ? "bg-success/10 text-success" : q.score > 40 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}>
                    {q.score}%
                  </Badge>
                </div>
                <p className="text-sm font-semibold">{q.questionText}</p>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Candidate Answer</p>
                  <div className="bg-muted/50 rounded-md px-3 py-2 text-sm border-l-2 border-primary/40">
                    {q.candidateAnswer || "No answer provided"}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Feedback</p>
                  <p className="text-xs text-muted-foreground">{q.feedback || "No feedback available."}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground">Performance insights from completed interviews.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Completed</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{loading ? "—" : results.length}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Score</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "—" : results.length > 0 ? Math.round(results.reduce((a, b) => a + b.avgScore, 0) / results.length) + "%" : "—"}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Top Performer</CardTitle></CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {loading ? "—" : results.length > 0 ? results.reduce((a, b) => a.avgScore > b.avgScore ? a : b).intervieweeName : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Completed Interviews</CardTitle>
          <CardDescription>Click on a candidate to view detailed performance</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Star className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No completed interviews to analyze yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedResult(r)}
                  className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{r.intervieweeName}</p>
                      <p className="text-xs text-muted-foreground">{r.interviewTitle} • {new Date(r.completedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={r.avgScore > 70 ? "bg-success/10 text-success" : r.avgScore > 40 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}>
                      {r.avgScore}%
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
