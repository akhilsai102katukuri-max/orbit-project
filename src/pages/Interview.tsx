import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Code, Layout } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Interview() {
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Live Session: Frontend Developer</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div> Live</span>
            <span>•</span>
            <span>00:15:32</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">End Session</Button>
          <Button size="sm" variant="destructive">Report Issue</Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <div className="col-span-2 flex flex-col gap-4">
          <div className="flex-1 bg-black rounded-lg relative overflow-hidden group">
             {/* Main Video Feed Placeholder */}
             <div className="absolute inset-0 flex items-center justify-center text-white/50">
                <div className="text-center">
                   <div className="h-24 w-24 rounded-full bg-white/10 mx-auto mb-4 flex items-center justify-center">
                     <span className="text-4xl">Candidate</span>
                   </div>
                   <p>Candidate Video Feed</p>
                </div>
             </div>
             
             {/* Small Self View */}
             <div className="absolute bottom-4 right-4 w-48 h-36 bg-slate-800 rounded-lg border border-white/10 shadow-lg overflow-hidden">
                <div className="w-full h-full flex items-center justify-center text-white/50 text-xs">
                  You
                </div>
             </div>

             {/* Controls Overlay */}
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-md p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant={micOn ? "secondary" : "destructive"} 
                  size="icon" 
                  className="rounded-full"
                  onClick={() => setMicOn(!micOn)}
                >
                  {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </Button>
                <Button 
                  variant={videoOn ? "secondary" : "destructive"} 
                  size="icon" 
                  className="rounded-full"
                  onClick={() => setVideoOn(!videoOn)}
                >
                  {videoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </Button>
                <Button variant="destructive" size="icon" className="rounded-full">
                  <PhoneOff className="h-4 w-4" />
                </Button>
             </div>
          </div>
        </div>

        <div className="col-span-1 flex flex-col gap-4 min-h-0">
          <Card className="flex-1 flex flex-col border-none shadow-sm">
            <Tabs defaultValue="questions" className="flex-1 flex flex-col">
              <div className="p-4 border-b">
                <TabsList className="w-full">
                  <TabsTrigger value="questions" className="flex-1"><MessageSquare className="h-4 w-4 mr-2"/> Questions</TabsTrigger>
                  <TabsTrigger value="code" className="flex-1"><Code className="h-4 w-4 mr-2"/> Code</TabsTrigger>
                  <TabsTrigger value="notes" className="flex-1"><Layout className="h-4 w-4 mr-2"/> Notes</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="questions" className="flex-1 p-0 m-0 min-h-0">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="outline">Q{i}</Badge>
                          <Badge variant="secondary" className="text-xs">React</Badge>
                        </div>
                        <p className="text-sm font-medium">Explain the Virtual DOM and how it differs from the Real DOM.</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="code" className="flex-1 p-4 m-0">
                <div className="h-full bg-slate-950 rounded-lg p-4 font-mono text-sm text-green-400 overflow-auto">
                  {`// Candidate Code Output
function calculatePrime(n) {
  if (n <= 1) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return false;
  }
  return true;
}`}
                </div>
              </TabsContent>

              <TabsContent value="notes" className="flex-1 p-4 m-0">
                <textarea 
                  className="w-full h-full resize-none p-3 rounded-md border focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  placeholder="Take private notes here..."
                />
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
