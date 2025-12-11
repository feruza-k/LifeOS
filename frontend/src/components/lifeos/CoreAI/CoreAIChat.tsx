import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, Mic, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConversationMessage } from "@/types/lifeos";
import { format } from "date-fns";

interface CoreAIChatProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ConversationMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  aiName?: string;
}

const quickActions = [
  { emoji: "✨", label: "What should I focus on today?" },
  { emoji: "📊", label: "Show my progress this week" },
  { emoji: "📋", label: "Add a new task" },
  { emoji: "🎯", label: "Set this month's focus" },
  { emoji: "⚙️", label: "Change check-in time" },
];

export function CoreAIChat({ 
  isOpen, 
  onClose, 
  messages, 
  onSendMessage, 
  isLoading = false,
  aiName = "SolAI"
}: CoreAIChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const handleQuickAction = (action: string) => {
    onSendMessage(action);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-serif font-semibold text-foreground">{aiName}</h2>
            <p className="text-xs font-sans text-muted-foreground">Your personal assistant</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-foreground mb-2">
              Hey there! I'm {aiName}
            </h3>
            <p className="text-sm text-muted-foreground font-sans max-w-xs mx-auto mb-6">
              I can help you manage tasks, set goals, track your progress, and more. What would you like to do?
            </p>
            
            {/* Quick actions */}
            <div className="space-y-2 max-w-sm mx-auto">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickAction(action.label)}
                  className="w-full p-3 text-left text-sm font-sans bg-card rounded-xl hover:bg-accent transition-colors flex items-center gap-2 shadow-soft"
                >
                  <span>{action.emoji}</span>
                  <span className="text-foreground">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl p-3 font-sans text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card text-foreground rounded-bl-md shadow-soft"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={cn(
                    "text-[10px] mt-1",
                    msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"
                  )}>
                    {format(new Date(msg.timestamp), "h:mm a")}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-card rounded-2xl rounded-bl-md p-3 shadow-soft">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              disabled={isLoading}
              className="w-full py-3 px-4 pr-12 bg-muted rounded-xl text-foreground font-sans text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-accent flex items-center justify-center"
            >
              <Mic className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
              input.trim() && !isLoading
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
