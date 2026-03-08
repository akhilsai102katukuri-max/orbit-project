import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Video, CheckCircle, Clock, Copy, Link2, Plus, Calendar, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Interview {
  id: string;
  title: string;
  session_code: string;
  scheduled_at: string | null;
  status: string;
  created_at: string;
  interviewee_name: string | null;
}

interface Participant {
  interview_id: string;
  status: string;
  user_id: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [respondentsCount, setRespondentsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    const { data: ivData } = await (supabase as any)
      .from("interviews")
      .select("*")
      .eq("company_user_id", user.id)
      .order("created_at", { ascending: false });

    const ivList = (ivData as any[]) || [];
    setInterviews(ivList);

    if (ivList.length > 0) {
      const interviewIds = ivList.map((i: Interview) => i.id);
      const { data: pData } = await (supabase as any)
        .from("interview_participants")
        .select("interview_id, status, user_id")
        .in("interview_id", interviewIds);

      const pList = (pData as any[]) || [];
      setParticipants(pList);

      const unique = new Set(pList.map((p: any) => p.user_id));
      setRespondentsCount(unique.size);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchData();

    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "interviews", filter: `company_user_id=eq.${user.id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "interview_participants" }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const getInterviewParticipants = (interviewId: string) =>
    participants.filter((p) => p.interview_id === interviewId);

  const isInterviewDone = (interview: Interview) => {
    const ivParticipants = getInterviewParticipants(interview.id);
    if (ivParticipants.length === 0) return false;
    return ivParticipants.every((p) => p.status === "completed" || p.status === "terminated");
  };

  const upcoming = interviews.filter((i) => i.status === "upcoming" && !isInterviewDone(i));
  const completed = interviews.filter((i) => i.status === "completed" || isInterviewDone(i));

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const getSessionUrl = (code: string) => `${window.location.origin}/join/${code}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Overview of your interview sessions.</p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/create-interview"><Plus className="h-4 w-4" /> New Interview</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Interviews", value: interviews.length, icon: Video, color: "text-primary", bg: "bg-primary/10" },
          { title: "Upcoming Sessions", value: upcoming.length, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
          { title: "Completed Sessions", value: completed.length, icon: CheckCircle, color: "text-success", bg: "bg-success/10" },
          { title: "Total Candidates", value: respondentsCount, icon: Users, color: "text-primary", bg: "bg-primary/10" },
        ].map((stat) => (
          <Card key={stat.title} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={`p-2 rounded-full ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "—" : stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Upcoming Sessions</CardTitle>
          <Button asChild variant="outline" size="sm" className="gap-1">
            <Link to="/create-interview"><Plus className="h-3 w-3" />New</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : upcoming.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No upcoming sessions.</p>
              <Button asChild variant="link" size="sm" className="mt-1">
                <Link to="/create-interview">Create one now</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((interview) => {
                const ivParticipants = getInterviewParticipants(interview.id);
                const hasTerminated = ivParticipants.some((p) => p.status === "terminated");
                return (
                  <div key={interview.id} className="p-4 rounded-lg border space-y-3 hover:bg-accent/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{interview.title}</p>
                        {interview.interviewee_name && (
                          <p className="text-xs text-muted-foreground">Candidate: {interview.interviewee_name}</p>
                        )}
                        {interview.scheduled_at && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {new Date(interview.scheduled_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {hasTerminated && (
                          <Badge variant="outline" className="text-xs border-destructive/30 bg-destructive/10 text-destructive gap-1">
                            <ShieldAlert className="h-3 w-3" /> Violation
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">Upcoming</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs font-mono flex-1 min-w-0">
                        <span className="text-muted-foreground">Code:</span>
                        <span className="font-bold tracking-widest">{interview.session_code}</span>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => copyToClipboard(interview.session_code, "Session code")}>
                        <Copy className="h-3 w-3" /> Code
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => copyToClipboard(getSessionUrl(interview.session_code), "Session URL")}>
                        <Link2 className="h-3 w-3" /> URL
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {completed.length > 0 && (
        <div className="text-center">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/completed-sessions">
              <CheckCircle className="h-4 w-4" /> View {completed.length} Completed Session{completed.length > 1 ? "s" : ""}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
