import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, UserCircle, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

type RoleTab = "company" | "interviewee";

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeRole, setActiveRole] = useState<RoleTab>("company");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        if (data.user) {
          await supabase.from("user_roles" as any).insert({
            user_id: data.user.id,
            role: activeRole,
          } as any);
          toast.success("Account created! Signing you in...");
          const dest = redirectTo || (activeRole === "company" ? "/dashboard" : "/interviewee");
          navigate(dest);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { data: roleData } = await supabase
            .from("user_roles" as any)
            .select("role")
            .eq("user_id", userData.user.id)
            .single();
          const userRole = (roleData as any)?.role;
          const dest = redirectTo || (userRole === "company" ? "/dashboard" : "/interviewee");
          navigate(dest);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
              O
            </div>
            <span className="text-2xl font-bold tracking-tight">ORBIT</span>
          </div>
          <p className="text-muted-foreground text-sm">AI-Powered Interview & Proctoring Platform</p>
        </div>

        <Card className="border shadow-lg animate-scale-in">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">{isSignup ? "Create Account" : "Welcome Back"}</CardTitle>
            <CardDescription>
              {isSignup ? "Choose your role to get started" : "Sign in to your account"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs value={activeRole} onValueChange={(v) => setActiveRole(v as RoleTab)} className="mb-6">
              <TabsList className="w-full">
                <TabsTrigger value="company" className="flex-1 gap-2">
                  <Building2 className="h-4 w-4" />
                  Company
                </TabsTrigger>
                <TabsTrigger value="interviewee" className="flex-1 gap-2">
                  <UserCircle className="h-4 w-4" />
                  Interviewee
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mb-4">
              <Badge variant="outline" className="text-xs">
                {activeRole === "company"
                  ? "Manage interviews, set questions & monitor candidates"
                  : "Take interviews, answer questions & showcase skills"}
              </Badge>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Full Name</label>
                  <Input placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email</label>
                <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Password</label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? "Please wait..." : isSignup ? "Create Account" : "Sign In"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button type="button" className="text-sm text-muted-foreground hover:text-primary transition-colors" onClick={() => setIsSignup(!isSignup)}>
                {isSignup ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
