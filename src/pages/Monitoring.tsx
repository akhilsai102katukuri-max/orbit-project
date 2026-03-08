import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, Search, Users, ShieldAlert, Video, X, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Participant {
  id: string;
  user_id: string;
  interview_id: string;
  status: string;
  joined_at: string;
}

interface ResponseData {
  score: number | null;
  interviewee_name: string | null;
  interviewee_user_id: string;
  feedback: string | null;
  question_id: string;
}

interface InterviewInfo {
  id: string;
  title: string;
}

interface ProctoringLog {
  user_id: string;
  interview_id: string;
  event_type: string;
  severity: string;
  details: string;
  created_at: string;
}

export default function Monitoring() {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [responses, setResponses] = useState<ResponseData[]>([]);
  const [interviews, setInterviews] = useState<InterviewInfo[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [proctoringLogs, setProctoringLogs] = useState<ProctoringLog[]>([]);
  const [questionsByInterview, setQuestionsByInterview] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState("");
  const [loadingVideo, setLoadingVideo] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;

    const { data: ivData } = await supabase
      .from("interviews" as any)
      .select("id, title")
      .eq("company_user_id", user.id);
    const ivList = (ivData as any[]) || [];
    setInterviews(ivList);

    if (ivList.length === 0) { setLoading(false); return; }

    const ivIds = ivList.map((i: any) => i.id);

    const { data: pData } = await supabase
      .from("interview_participants" as any)
      .select("*")
      .in("interview_id", ivIds);
    setParticipants((pData as any[]) || []);

    const { data: qData } = await supabase
      .from("interview_questions" as any)
      .select("id, interview_id")
      .in("interview_id", ivIds);
    const questions = (qData as any[]) || [];

    if (questions.length > 0) {
      const qIds = questions.map((q: any) => q.id);
      // Map interview_id -> question ids
      const qMap: Record<string, string[]> = {};
      questions.forEach((q: any) => {
        if (!qMap[q.interview_id]) qMap[q.interview_id] = [];
        qMap[q.interview_id].push(q.id);
      });
      setQuestionsByInterview(qMap);

      const { data: rData } = await supabase
        .from("interviewee_responses" as any)
        .select("score, interviewee_name, interviewee_user_id, feedback, question_id")
        .in("question_id", qIds);
      setResponses((rData as any[]) || []);
    }

    const { data: logData } = await (supabase as any)
      .from("proctoring_logs")
      .select("user_id, interview_id, event_type, severity, details, created_at")
      .in("interview_id", ivIds)
      .order("created_at", { ascending: false });
    setProctoringLogs((logData as any[]) || []);

    const userIds = [...new Set((pData as any[] || []).map((p: any) => p.user_id))];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles" as any)
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      const pMap: Record<string, any> = {};
      (profileData as any[] || []).forEach((p: any) => { pMap[p.user_id] = p; });
      setProfiles(pMap);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchData();

    const channel = supabase
      .channel("monitoring-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "interview_participants" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "interviewee_responses" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "proctoring_logs" }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const getInterviewTitle = (interviewId: string) => interviews.find((i) => i.id === interviewId)?.title || "Unknown";

  const getParticipantName = (p: Participant) => {
    const profile = profiles[p.user_id];
    if (profile?.full_name) return profile.full_name;
    const resp = responses.find((r) => r.interviewee_user_id === p.user_id);
    if (resp?.interviewee_name) return resp.interviewee_name;
    return profile?.email || "Unknown";
  };

  const getParticipantScore = (p: Participant) => {
    const ivQIds = new Set(questionsByInterview[p.interview_id] || []);
    const userResponses = responses.filter((r) =>
      r.interviewee_user_id === p.user_id &&
      r.score !== null &&
      ivQIds.has(r.question_id)
    );
    if (userResponses.length === 0) return null;
    return Math.round(userResponses.reduce((a, b) => a + (b.score || 0), 0) / userResponses.length);
  };

  const getViolationCount = (p: Participant) => {
    return proctoringLogs.filter((l) => l.user_id === p.user_id && l.interview_id === p.interview_id).length;
  };

  const getTopViolation = (p: Participant) => {
    const logs = proctoringLogs.filter((l) => l.user_id === p.user_id && l.interview_id === p.interview_id);
    if (logs.length === 0) return null;
    return logs.find((l) => l.severity === "high") || logs[0];
  };

  const handleViewRecording = async (p: Participant) => {
    const key = p.user_id + "_" + p.interview_id;
    setLoadingVideo(key);
    try {
      let signedUrl: string | null = null;

      // Files are saved as: {user_id}/{interview_id}_{timestamp}.webm
      // List files in user folder to find matching interview recording
      const { data: files } = await supabase.storage
        .from("interview-recordings")
        .list(p.user_id, { search: p.interview_id });

      if (files && files.length > 0) {
        // Pick the most recent one if multiple
        const sorted = files.sort((a: any, b: any) => b.name.localeCompare(a.name));
        const filePath = `${p.user_id}/${sorted[0].name}`;
        const { data } = await supabase.storage
          .from("interview-recordings")
          .createSignedUrl(filePath, 3600);
        if (data?.signedUrl) {
          signedUrl = data.signedUrl;
          setVideoName(getParticipantName(p) + " — " + getInterviewTitle(p.interview_id));
        }
      }

      if (signedUrl) {
        setVideoUrl(signedUrl);
      } else {
        toast.error("Recording not found for this candidate.");
      }
    } catch {
      toast.error("Could not load recording.");
    } finally {
      setLoadingVideo(null);
    }
  };

  const filteredParticipants = participants
    .filter((p) => getParticipantName(p).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime());

  const activeCount = participants.filter((p) => p.status === "joined").length;
  const completedCount = participants.filter((p) => p.status === "completed").length;
  const terminatedCount = participants.filter((p) => p.status === "terminated").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Proctoring Monitor</h2>
          <p className="text-muted-foreground">Real-time monitoring of interview sessions.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search candidates..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-success/10 border-success/20">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-success">Active Sessions</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-success">{loading ? "—" : activeCount}</div></CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/20">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-primary">Completed</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{loading ? "—" : completedCount}</div></CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-destructive">Terminated</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{loading ? "—" : terminatedCount}</div></CardContent>
        </Card>
        <Card className="bg-muted border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Participants</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{loading ? "—" : participants.length}</div></CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle>Candidates</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : filteredParticipants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No participants yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Interview</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Violations</TableHead>
                  <TableHead>Termination Reason</TableHead>
                  <TableHead>Recording</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParticipants.map((p) => {
                  const score = getParticipantScore(p);
                  const violationCount = getViolationCount(p);
                  const topViolation = getTopViolation(p);
                  const isTerminated = p.status === "terminated";
                  const key = p.user_id + "_" + p.interview_id;
                  return (
                    <TableRow key={p.id} className={isTerminated ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium">{getParticipantName(p)}</TableCell>
                      <TableCell className="text-sm">{getInterviewTitle(p.interview_id)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          p.status === "completed" ? "border-success/20 bg-success/10 text-success"
                          : p.status === "terminated" ? "border-destructive/20 bg-destructive/10 text-destructive"
                          : "border-primary/20 bg-primary/10 text-primary"
                        }>
                          {p.status === "terminated" && <ShieldAlert className="h-3 w-3 mr-1 inline" />}
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {score !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full ${score > 70 ? "bg-success" : score > 40 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${score}%` }} />
                            </div>
                            <span className="text-sm text-muted-foreground">{score}%</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {violationCount > 0 ? (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                            <span className="text-sm font-medium text-destructive">{violationCount}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-success" />
                            <span className="text-xs text-muted-foreground">Clean</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] text-xs">
                        {isTerminated && topViolation ? (
                          <span className="text-destructive font-medium">{topViolation.details}</span>
                        ) : isTerminated ? (
                          <span className="text-destructive font-medium">Terminated due to violations</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {(p.status === "completed" || p.status === "terminated") ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-7 text-xs"
                            disabled={loadingVideo === key}
                            onClick={() => handleViewRecording(p)}
                          >
                            {loadingVideo === key ? (
                              <span className="animate-pulse">Loading...</span>
                            ) : (
                              <><Play className="h-3 w-3" /> Watch</>
                            )}
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Video className="h-3 w-3" /> Live
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Video Player Dialog */}
      <Dialog open={!!videoUrl} onOpenChange={(open) => { if (!open) setVideoUrl(null); }}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" /> {videoName}
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-lg overflow-hidden bg-black aspect-video">
            {videoUrl && (
              <video
                src={videoUrl}
                controls
                autoPlay
                className="w-full h-full"
                onError={() => {
                  toast.error("Could not play recording.");
                  setVideoUrl(null);
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
