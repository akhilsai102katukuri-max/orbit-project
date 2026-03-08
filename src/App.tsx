import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import IntervieweeLayout from "./components/IntervieweeLayout";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import CompletedSessions from "./pages/CompletedSessions";
import Interview from "./pages/Interview";
import Monitoring from "./pages/Monitoring";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import IntervieweeDashboard from "./pages/IntervieweeDashboard";
import IntervieweeSession from "./pages/IntervieweeSession";
import IntervieweeSessions from "./pages/IntervieweeSessions";
import IntervieweeSettings from "./pages/IntervieweeSettings";
import CompanyQuestions from "./pages/CompanyQuestions";
import JoinSession from "./pages/JoinSession";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function CompanyLayout() {
  return (
    <ProtectedRoute requiredRole="company">
      <Layout />
    </ProtectedRoute>
  );
}

function IntervieweeProtectedLayout() {
  return (
    <ProtectedRoute requiredRole="interviewee">
      <IntervieweeLayout />
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/join/:code" element={<JoinSession />} />

            {/* Company routes */}
            <Route element={<CompanyLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/interviews" element={<Interview />} />
              <Route path="/create-interview" element={<CompanyQuestions />} />
              <Route path="/completed-sessions" element={<CompletedSessions />} />
              <Route path="/monitoring" element={<Monitoring />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Interviewee routes */}
            <Route element={<IntervieweeProtectedLayout />}>
              <Route path="/interviewee" element={<IntervieweeDashboard />} />
              <Route path="/interviewee/session/:interviewId" element={<IntervieweeSession />} />
              <Route path="/interviewee/sessions" element={<IntervieweeSessions />} />
              <Route path="/interviewee/settings" element={<IntervieweeSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
