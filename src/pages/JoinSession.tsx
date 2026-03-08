import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function JoinSession() {
  const { code } = useParams();
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "found" | "not_found">("loading");
  const [interview, setInterview] = useState<any>(null);

  useEffect(() => {
    if (!code) { navigate("/login"); return; }
    const lookup = async () => {
      const { data, error } = await supabase
        .from("interviews" as any)
        .select("id, title, scheduled_at")
        .eq("session_code", code.toUpperCase())
        .single();
      if (error || !data) {
        setStatus("not_found");
      } else {
        setInterview(data);
        setStatus("found");
      }
    };
    lookup();
  }, [code, navigate]);

  useEffect(() => {
    if (authLoading || status !== "found" || !interview) return;
    if (!user) {
      navigate(`/login?redirect=/join/${code}`);
      return;
    }

    const checkAndRedirect = async () => {
      if (role === "interviewee") {
        const { data: participant } = await (supabase as any)
          .from("interview_participants")
          .select("status")
          .eq("interview_id", interview.id)
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

        navigate(`/interviewee/session/${interview.id}`);
      }
    };

    checkAndRedirect();
  }, [authLoading, status, interview, user, role, navigate, code]);

  if (status === "loading" || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg text-center">
          <CardHeader>
            <CardTitle>Session Not Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              The session code <span className="font-mono font-bold">{code}</span> is invalid or has expired.
            </p>
            <Button onClick={() => navigate("/login")} className="w-full gap-2">
              Go to Login <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary">O</span>
          </div>
          <CardTitle>Joining Interview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="font-medium text-lg">{interview?.title}</p>
          {interview?.scheduled_at && (
            <p className="text-sm text-muted-foreground">
              Scheduled: {new Date(interview.scheduled_at).toLocaleString()}
            </p>
          )}
          <p className="text-sm text-muted-foreground">Redirecting you to the session...</p>
          <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
        </CardContent>
      </Card>
    </div>
  );
}
