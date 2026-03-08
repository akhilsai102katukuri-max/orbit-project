import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Camera, HelpCircle, MessageCircle } from "lucide-react";

export default function IntervieweeSettings() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles" as any)
      .select("full_name, avatar_url")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setFullName((data as any).full_name || "");
          setAvatarUrl((data as any).avatar_url || null);
        }
      });
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !user) return;
    setUploading(true);
    try {
      const file = e.target.files[0];
      const filePath = `${user.id}/avatar_${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from("interview-recordings").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("interview-recordings").getPublicUrl(filePath);
      await supabase.from("profiles" as any).update({ avatar_url: urlData.publicUrl } as any).eq("user_id", user.id);
      setAvatarUrl(urlData.publicUrl);
      toast.success("Profile photo updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from("profiles" as any).update({ full_name: fullName } as any).eq("user_id", user.id);
      toast.success("Profile updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Profile Settings</h2>
        <p className="text-muted-foreground">Manage your personal information and preferences.</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>This information will be shown to interviewers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="h-20 w-20 border-2 border-border">
                {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
                <AvatarFallback className="text-2xl">{fullName?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Camera className="h-6 w-6 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
              </label>
            </div>
            <div>
              <p className="font-semibold text-lg">{fullName || "Set your name"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant="secondary" className="mt-1">Interviewee</Badge>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" className="mt-1.5" />
              <p className="text-xs text-muted-foreground mt-1">This name will appear on your interview submissions.</p>
            </div>

            <div>
              <Label>Email Address</Label>
              <Input value={user?.email || ""} disabled className="mt-1.5 bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help Desk */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" /> Help & Support
          </CardTitle>
          <CardDescription>Need help? Here are some quick answers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { q: "How do I join an interview?", a: "Go to your Dashboard and enter the session code or URL provided by the company." },
            { q: "Can I retake an interview?", a: "No, each interview session can only be taken once. Contact the company for a new session." },
            { q: "What if my microphone doesn't work?", a: "Make sure you're using Google Chrome and have granted microphone permissions. Check your browser settings." },
            { q: "How is my score calculated?", a: "Your spoken answers are transcribed and compared to the expected answers using AI. You receive a score (0-100) and feedback per question." },
          ].map((faq) => (
            <div key={faq.q} className="p-3 rounded-lg border">
              <div className="flex items-start gap-2">
                <MessageCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{faq.q}</p>
                  <p className="text-xs text-muted-foreground mt-1">{faq.a}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </div>
  );
}
