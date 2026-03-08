import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { IntervieweeSidebar } from "./IntervieweeSidebar";
import { Outlet } from "react-router-dom";

export default function IntervieweeLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <IntervieweeSidebar />
        <main className="flex-1 overflow-y-auto">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-foreground">Interviewee Portal</h1>
            </div>
          </header>
          <div className="p-6 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
