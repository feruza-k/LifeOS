import { useState } from "react";
import { Sparkles, X, MessageCircle, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoreAIChat } from "./CoreAIChat";
import { ConversationMessage } from "@/types/lifeos";
import { format } from "date-fns";

interface CoreAIFABProps {
  messages: ConversationMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  aiName?: string;
  notification?: string;
}

export function CoreAIFAB({ 
  messages, 
  onSendMessage, 
  isLoading = false,
  aiName = "SolAI",
  notification
}: CoreAIFABProps) {
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(!!notification);

  const handleSendMessage = (message: string) => {
    onSendMessage(message);
  };

  const openFullScreen = () => {
    setIsQuickViewOpen(false);
    setIsFullScreen(true);
  };

  return (
    <>
      <div className="fixed bottom-20 right-4 z-40">
        {/* AI Tooltip */}
        {showTooltip && !isQuickViewOpen && !isFullScreen && notification && (
          <div 
            className="absolute bottom-16 right-0 w-64 p-3 bg-card rounded-2xl shadow-card border border-border animate-scale-in"
            style={{ animationDelay: "1s" }}
          >
            <button
              onClick={() => setShowTooltip(false)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-muted flex items-center justify-center"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
            <div className="flex items-start gap-2">
              <MessageCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm font-sans text-foreground leading-relaxed">
                {notification}
              </p>
            </div>
          </div>
        )}

        {/* FAB Button */}
        {!isQuickViewOpen && !isFullScreen && (
          <button
            onClick={() => {
              setIsQuickViewOpen(true);
              setShowTooltip(false);
            }}
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center shadow-fab transition-all duration-300",
              "bg-gradient-to-br from-primary to-primary/80 hover:scale-105"
            )}
          >
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </button>
        )}
      </div>

      {/* Quick View Panel - Notion-style vertical */}
      {isQuickViewOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-80 bg-card rounded-2xl shadow-card border border-border animate-scale-in max-h-[70vh] flex flex-col">
          {/* Quick View Header */}
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-serif font-semibold text-foreground">{aiName}</h2>
                <p className="text-xs font-sans text-muted-foreground">Your personal assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openFullScreen}
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
              >
                <Maximize2 className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => setIsQuickViewOpen(false)}
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Quick View Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
            {messages.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground font-sans mb-4">
                  Hey! How can I help you today?
                </p>
                <div className="space-y-2">
                  {[
                    { emoji: "✨", label: "What should I focus on?" },
                    { emoji: "📊", label: "Show my progress" },
                    { emoji: "📋", label: "Add a task" },
                  ].map((action, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(action.label)}
                      className="w-full p-3 text-left text-sm font-sans bg-muted rounded-xl hover:bg-accent transition-colors flex items-center gap-2"
                    >
                      <span>{action.emoji}</span>
                      <span className="text-foreground">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.slice(-3).map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl p-3 font-sans text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
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
              ))
            )}
          </div>

          {/* Quick View Input */}
          <div className="p-3 border-t border-border shrink-0">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.querySelector('input');
                if (input?.value.trim()) {
                  handleSendMessage(input.value.trim());
                  input.value = '';
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask me anything..."
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 bg-muted rounded-xl text-foreground font-sans text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Full Chat View */}
      <CoreAIChat
        isOpen={isFullScreen}
        onClose={() => setIsFullScreen(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        aiName={aiName}
      />
    </>
  );
}
