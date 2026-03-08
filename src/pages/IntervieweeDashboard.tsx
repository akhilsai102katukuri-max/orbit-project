import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Video, Clock, CheckCircle, BookOpen, ArrowRight, Hash, Link2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function IntervieweeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [completedCount, setCompletedCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionCode, setSessionCode] = useState("");
  const [joiningByCode, setJoiningByCode] = useState(false);

  const fetchCounts = async () => {
    if (!user) return;

    // Get participant records for this user
    const { data: pData } = await supabase
      .from("interview_participants" as any)
      .select("interview_id, status")
      .eq("user_id", user.id);

    const participants = (pData as any[]) || [];
    setCompletedCount(participants.filter((p: any) => p.status === "completed").length);
    setActiveCount(participants.filter((p: any) => p.status === "joined").length);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchCounts();

    const channel = supabase
      .channel("interviewee-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "interview_participants", filter: `user_id=eq.${user.id}` }, () => fetchCounts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleJoinByCode = async () => {
    const code = sessionCode.trim().toUpperCase();
    if (!code || code.length < 4) {
      toast.error("Please enter a valid session code");
      return;
    }
    setJoiningByCode(true);
    try {
      const { data, error } = await supabase
        .from("interviews" as any)
        .select("id, title")
        .eq("session_code", code)
        .single();
      if (error || !data) {
        toast.error("Invalid session code. Please check and try again.");
        return;
      }
      navigate(`/interviewee/session/${(data as any).id}`);
    } catch {
      toast.error("Could not find session. Please try again.");
    } finally {
      setJoiningByCode(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Welcome Back!</h2>
        <p className="text-muted-foreground">Join interviews using your session code or URL.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Active Sessions", value: activeCount, icon: BookOpen, color: "text-primary" },
          { title: "Completed", value: completedCount, icon: CheckCircle, color: "text-success" },
          { title: "Total Sessions", value: activeCount + completedCount, icon: Clock, color: "text-warning" },
        ].map((s) => (
          <Card key={s.title} className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.title}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "—" : s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Join by Code */}
      <Card className="border-none shadow-sm border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary" /> Join with Session Code or URL
          </CardTitle>
          <CardDescription>Enter the session code or paste the URL provided by the company</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter code (e.g. AB12CD34) or paste URL..."
              value={sessionCode}
              onChange={(e) => {
                const val = e.target.value;
                if (val.includes("/join/")) {
                  const parts = val.split("/join/");
                  setSessionCode(parts[parts.length - 1].trim().toUpperCase());
                } else {
                  setSessionCode(val.toUpperCase());
                }
              }}
              className="font-mono"
              onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
            />
            <Button onClick={handleJoinByCode} disabled={joiningByCode} className="gap-2 flex-shrink-0">
              {joiningByCode ? "Joining..." : "Join"} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            <Link2 className="h-3 w-3 inline mr-1" />
            You can also open the session URL directly in your browser
          </p>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/interviewee/sessions")}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Video className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">My Sessions</p>
              <p className="text-sm text-muted-foreground">View completed interviews & scores</p>
            </div>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/interviewee/settings")}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center">
              <Hash className="h-6 w-6 text-accent-foreground" />
            </div>
            <div>
              <p className="font-medium">Profile Settings</p>
              <p className="text-sm text-muted-foreground">Update your name & photo</p>
            </div>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
