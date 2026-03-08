import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, Brain, Video, BarChart3, Mic, Users, ArrowRight, 
  CheckCircle, Sparkles, Eye, Lock, Globe 
} from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  {
    icon: Mic,
    title: "Voice-Powered Answers",
    desc: "Candidates answer via speech-to-text — no typing, just natural conversation.",
  },
  {
    icon: Brain,
    title: "AI Scoring & Feedback",
    desc: "Every answer is evaluated by AI against expected answers with detailed feedback.",
  },
  {
    icon: Shield,
    title: "Anti-Cheat Proctoring",
    desc: "Fullscreen lock, tab-switch detection, copy-paste blocking, and 3-strike warnings.",
  },
  {
    icon: Video,
    title: "Video Recording",
    desc: "Every session is recorded securely for company review and compliance.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    desc: "Live dashboards with candidate scores, session progress, and performance graphs.",
  },
  {
    icon: Users,
    title: "Dual Dashboard",
    desc: "Separate portals for companies and candidates with role-based access control.",
  },
];

const stats = [
  { value: "99.9%", label: "Uptime" },
  { value: "<2s", label: "AI Response" },
  { value: "100%", label: "Secure" },
  { value: "24/7", label: "Available" },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-[#FFF8F0] text-[#1a1a2e] overflow-x-hidden">
      {/* Decorative Mandala Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full border-[40px] border-[#FF9933]" />
        <div className="absolute -bottom-60 -left-60 w-[800px] h-[800px] rounded-full border-[50px] border-[#138808]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border-[30px] border-[#FF9933] rotate-45" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-4 bg-white/80 backdrop-blur-md border-b border-[#FF9933]/20">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF9933] to-[#FF6600] text-white font-bold text-lg shadow-lg">
            O
          </div>
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-[#FF9933]">OR</span>
            <span className="text-[#1a1a2e]">B</span>
            <span className="text-[#138808]">IT</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild className="text-[#1a1a2e] hover:text-[#FF9933]">
            <Link to="/login">Sign In</Link>
          </Button>
          <Button asChild className="bg-gradient-to-r from-[#FF9933] to-[#FF6600] hover:from-[#e88a2e] hover:to-[#e65c00] text-white shadow-lg shadow-[#FF9933]/30">
            <Link to="/login">Get Started <ArrowRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-12 pt-20 pb-16 max-w-6xl mx-auto text-center">
        {/* Decorative top border - rangoli inspired */}
        <div className="flex justify-center gap-2 mb-8">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: i % 2 === 0 ? "#FF9933" : "#138808",
                opacity: 0.6 + i * 0.1,
              }}
            />
          ))}
        </div>

        <Badge className="bg-[#FF9933]/10 text-[#FF9933] border-[#FF9933]/30 mb-6 px-4 py-1.5 text-sm font-medium">
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          AI-Powered Interview Platform
        </Badge>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
          <span className="bg-gradient-to-r from-[#FF9933] via-[#e65c00] to-[#FF9933] bg-clip-text text-transparent">
            Smarter Interviews.
          </span>
          <br />
          <span className="text-[#1a1a2e]">Stronger </span>
          <span className="bg-gradient-to-r from-[#138808] to-[#0d6b06] bg-clip-text text-transparent">
            Hiring.
          </span>
        </h1>

        <p className="text-lg md:text-xl text-[#555] max-w-2xl mx-auto mb-10 leading-relaxed">
          ORBIT transforms interviews with AI scoring, voice-based answers, live proctoring, 
          and real-time analytics — all in one secure platform built for modern recruitment.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Button size="lg" asChild className="bg-gradient-to-r from-[#FF9933] to-[#FF6600] hover:from-[#e88a2e] hover:to-[#e65c00] text-white text-lg px-8 py-6 shadow-xl shadow-[#FF9933]/25 rounded-xl">
            <Link to="/login">
              Start Hiring <ArrowRight className="h-5 w-5 ml-2" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="border-2 border-[#138808]/30 text-[#138808] hover:bg-[#138808]/5 text-lg px-8 py-6 rounded-xl">
            <Link to="/login">
              Join as Candidate
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-extrabold text-[#FF9933]">{s.value}</div>
              <div className="text-sm text-[#888] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Divider - Rangoli pattern */}
      <div className="flex justify-center items-center gap-1 py-4">
        <div className="h-px w-20 bg-gradient-to-r from-transparent to-[#FF9933]/40" />
        <div className="w-2 h-2 rotate-45 bg-[#FF9933]/60" />
        <div className="w-3 h-3 rotate-45 border-2 border-[#138808]/60" />
        <div className="w-2 h-2 rotate-45 bg-[#FF9933]/60" />
        <div className="h-px w-20 bg-gradient-to-l from-transparent to-[#FF9933]/40" />
      </div>

      {/* Features */}
      <section className="relative z-10 px-6 md:px-12 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything You Need for{" "}
            <span className="text-[#FF9933]">Modern Interviews</span>
          </h2>
          <p className="text-[#666] max-w-xl mx-auto">
            From AI-powered evaluation to real-time monitoring — ORBIT handles it all.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card
              key={f.title}
              className="bg-white/80 backdrop-blur border-[#FF9933]/10 hover:border-[#FF9933]/30 hover:shadow-xl hover:shadow-[#FF9933]/5 transition-all duration-300 group"
            >
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#FF9933]/10 to-[#138808]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <f.icon className="h-6 w-6 text-[#FF9933]" />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-[#666] leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 px-6 md:px-12 py-20 bg-gradient-to-b from-[#FF9933]/5 to-[#138808]/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How <span className="text-[#138808]">ORBIT</span> Works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Create & Share",
                desc: "Companies create interview sessions with questions and share unique codes with candidates.",
                color: "#FF9933",
              },
              {
                step: "02",
                title: "Interview & Record",
                desc: "Candidates answer via voice in a proctored, fullscreen environment. Every session is recorded.",
                color: "#1a1a2e",
              },
              {
                step: "03",
                title: "AI Scores & Analyze",
                desc: "AI evaluates answers, generates scores and feedback. Companies see results in real-time dashboards.",
                color: "#138808",
              },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div
                  className="text-5xl font-extrabold mb-4 opacity-20"
                  style={{ color: s.color }}
                >
                  {s.step}
                </div>
                <h3 className="font-bold text-xl mb-2">{s.title}</h3>
                <p className="text-sm text-[#666] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="relative z-10 px-6 md:px-12 py-20 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Badge className="bg-[#138808]/10 text-[#138808] border-[#138808]/30 mb-4">
              <Lock className="h-3 w-3 mr-1" /> Enterprise Security
            </Badge>
            <h2 className="text-3xl font-bold mb-4">
              Built with <span className="text-[#138808]">Trust & Security</span>
            </h2>
            <div className="space-y-4">
              {[
                { icon: Eye, text: "Real-time proctoring with tab & fullscreen monitoring" },
                { icon: Lock, text: "Anti-cheat: clipboard blocking, 3-strike termination" },
                { icon: Shield, text: "Role-based access with row-level security" },
                { icon: Globe, text: "Works on all modern browsers — no installation needed" },
              ].map((item) => (
                <div key={item.text} className="flex items-start gap-3">
                  <div className="mt-0.5 h-6 w-6 rounded-full bg-[#138808]/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-3.5 w-3.5 text-[#138808]" />
                  </div>
                  <p className="text-sm text-[#555]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="aspect-square rounded-3xl bg-gradient-to-br from-[#FF9933]/10 via-white to-[#138808]/10 border border-[#FF9933]/20 flex items-center justify-center">
              <div className="text-center">
                <Shield className="h-20 w-20 text-[#FF9933]/40 mx-auto mb-4" />
                <p className="text-2xl font-bold text-[#1a1a2e]/60">100% Secure</p>
                <p className="text-sm text-[#888]">Enterprise-grade protection</p>
              </div>
            </div>
            {/* Decorative dots */}
            <div className="absolute -top-4 -right-4 w-8 h-8 rounded-full bg-[#FF9933]/20" />
            <div className="absolute -bottom-4 -left-4 w-6 h-6 rounded-full bg-[#138808]/20" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 md:px-12 py-20">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-[#FF9933] via-[#e65c00] to-[#FF9933] rounded-3xl p-12 md:p-16 shadow-2xl shadow-[#FF9933]/20">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Hiring?
          </h2>
          <p className="text-white/80 max-w-lg mx-auto mb-8">
            Join companies already using ORBIT for smarter, faster, and more secure interviews.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="bg-white text-[#FF9933] hover:bg-white/90 text-lg px-8 py-6 rounded-xl font-bold shadow-lg">
              <Link to="/login">
                Start Free <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 md:px-12 py-10 border-t border-[#FF9933]/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF9933] to-[#FF6600] text-white font-bold text-sm">
              O
            </div>
            <span className="font-bold text-lg">
              <span className="text-[#FF9933]">OR</span>
              <span>B</span>
              <span className="text-[#138808]">IT</span>
            </span>
          </div>
          <p className="text-sm text-[#888]">
            © 2026 ORBIT — AI-Powered Interview & Proctoring Platform. Made with ❤️ in India.
          </p>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded-sm bg-[#FF9933]" />
            <div className="w-4 h-3 rounded-sm bg-white border" />
            <div className="w-4 h-3 rounded-sm bg-[#138808]" />
          </div>
        </div>
      </footer>
    </div>
  );
}
