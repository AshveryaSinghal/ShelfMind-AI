import { useState, useRef, useEffect } from "react";
import { useAskAssistant } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Send, Loader2, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  shelfIds?: string[];
};

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([{
    id: "init",
    role: "assistant",
    content: "Hello. I'm ShelfMind AI. Ask me about store performance, specific aisles, or restocking priorities.",
  }]);
  const [input, setInput] = useState("");
  const [shelfFilter, setShelfFilter] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const askAssistant = useAskAssistant();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || askAssistant.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");

    const shelves = shelfFilter.trim()
      ? shelfFilter.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    askAssistant.mutate({
      data: {
        question: userMessage.content,
        shelf_ids: shelves && shelves.length > 0 ? shelves : null
      }
    }, {
      onSuccess: (response) => {
        setMessages(prev => [...prev, {
          id: Date.now().toString() + "-ai",
          role: "assistant",
          content: response.answer,
          shelfIds: response.shelf_ids_used
        }]);
      },
      onError: (err) => {
        setMessages(prev => [...prev, {
          id: Date.now().toString() + "-err",
          role: "assistant",
          content: "I encountered an error analyzing the data. Please try again."
        }]);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground mt-1">Query your shelf analytics data using natural language.</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden border shadow-md">
        <CardHeader className="bg-muted/30 border-b py-3 px-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">ShelfMind AI</CardTitle>
              <CardDescription className="text-xs">Context-aware data analysis</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col relative">
          <ScrollArea className="flex-1 p-6" ref={scrollRef}>
            <div className="space-y-6 pb-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground border"
                  }`}>
                    {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>

                  <div className={`flex flex-col max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div className={`px-4 py-3 rounded-2xl text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted/60 text-foreground border rounded-tl-sm"
                    }`}>
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    </div>

                    {msg.shelfIds && msg.shelfIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-xs text-muted-foreground mr-1 flex items-center">
                          <Target className="h-3 w-3 mr-1" /> Source:
                        </span>
                        {msg.shelfIds.map(id => (
                          <Badge key={id} variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {id}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {askAssistant.isPending && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-muted text-foreground border flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-muted/60 border px-4 py-3 rounded-2xl rounded-tl-sm text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing data...
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <div className="p-4 border-t bg-background">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-2">
              <Label htmlFor="filter" className="text-xs text-muted-foreground whitespace-nowrap">Target Shelves:</Label>
              <Input
                id="filter"
                value={shelfFilter}
                onChange={e => setShelfFilter(e.target.value)}
                placeholder="All shelves (or AISLE-1, AISLE-2)"
                className="h-7 text-xs bg-muted/50 border-dashed"
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about health scores, empty gaps, or priorities..."
                className="py-6 rounded-xl shadow-sm"
                disabled={askAssistant.isPending}
              />
              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 rounded-lg shrink-0"
                disabled={!input.trim() || askAssistant.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
