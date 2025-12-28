import { useState, useEffect } from "react";
import { Sparkles, X, MessageCircle, Maximize2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoreAIChat } from "./CoreAIChat";
import { ConfirmationCard } from "./ConfirmationCard";
import { ConversationMessage } from "@/types/lifeos";
import { formatMessageTime } from "@/utils/timeUtils";
import { api } from "@/lib/api";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface CoreAIFABProps {
  messages: ConversationMessage[];
  onSendMessage: (message: string) => void;
  onConfirmAction?: () => void;
  isLoading?: boolean;
  aiName?: string;
  notification?: string;
  onClearHistory?: () => void;
  currentView?: string;
  selectedTaskId?: string;
  selectedDate?: string;
}

export function CoreAIFAB({ 
  messages, 
  onSendMessage,
  onConfirmAction,
  isLoading = false,
  aiName = "SolAI",
  notification,
  onClearHistory,
  currentView = "today",
  selectedTaskId,
  selectedDate
}: CoreAIFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [contextActions, setContextActions] = useState<any[]>([]);

  // Load context actions
  useEffect(() => {
    if (isOpen || isFullScreen) {
      const loadContextActions = async () => {
        try {
          const actions = await api.getContextActions(currentView, selectedTaskId, selectedDate);
          setContextActions(actions.actions || []);
        } catch (error) {
          console.error("Failed to load context actions:", error);
        }
      };
      loadContextActions();
    }
  }, [isOpen, isFullScreen, currentView, selectedTaskId, selectedDate]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onOpen: () => !isOpen && !isFullScreen && setIsOpen(true),
    onClose: () => (isOpen || isFullScreen) && (setIsOpen(false), setIsFullScreen(false)),
  });

  const handleSendMessage = (message: string) => {
    onSendMessage(message);
  };

  return (
    <>
      {/* FAB Button - Bottom right */}
      {!isOpen && (
        <div className="fixed bottom-20 right-4 z-40">

          {/* FAB Button */}
          <button
            onClick={() => {
              setIsOpen(true);
              setShowTooltip(false);
            }}
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center shadow-fab transition-all duration-300",
              "bg-gradient-to-br from-primary to-primary/80 hover:scale-105"
            )}
          >
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </button>
        </div>
      )}

      {/* Bottom Sheet - Mobile-first design */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Bottom Sheet */}
          <div className="relative w-full max-w-lg bg-card rounded-t-3xl shadow-card animate-slide-up overflow-hidden flex flex-col max-h-[85vh]">
            {/* Contextual Info Panel - Show when there are notifications or important info */}
            {notification && (
              <div className="p-4 bg-primary/5 border-b border-primary/10">
                <div className="flex items-start gap-2">
                  <MessageCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-sans text-foreground leading-relaxed flex-1">
                    {notification}
                  </p>
                </div>
              </div>
            )}
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-sans font-bold text-foreground">{aiName}</h2>
                  <p className="text-xs font-sans text-muted-foreground">Your personal assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setIsFullScreen(true);
                  }}
                  className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                  title="Open full screen"
                >
                  <Maximize2 className="w-4 h-4 text-muted-foreground" />
                </button>
                {messages.length > 0 && onClearHistory && (
                  <button
                    onClick={onClearHistory}
                    className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                    title="Clear conversation"
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Messages - Card-based design */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-sans text-lg font-bold text-foreground mb-2">
                    Hey there! I'm {aiName}
                  </h3>
                  <p className="text-sm text-muted-foreground font-sans max-w-xs mx-auto mb-6">
                    I can help you manage tasks, set goals, track your progress, and more. What would you like to do?
                  </p>
                  
                  {/* Context-aware quick actions */}
                  <div className="space-y-2 max-w-sm mx-auto">
                    {contextActions.length > 0 ? (
                      contextActions.slice(0, 3).map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleSendMessage(action.label)}
                          className="w-full p-3 text-left text-sm font-sans bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-border/30"
                        >
                          <span className="text-foreground">{action.label}</span>
                        </button>
                      ))
                    ) : (
                      [
                        { label: "What should I focus on today?" },
                        { label: "Show my progress this week" },
                        { label: "Add a new task" },
                      ].map((action, i) => (
                        <button
                          key={i}
                          onClick={() => handleSendMessage(action.label)}
                          className="w-full p-3 text-left text-sm font-sans bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-border/30"
                        >
                          <span className="text-foreground">{action.label}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div key={msg.id} className="space-y-1.5">
                      <div
                        className={cn(
                          "flex",
                          msg.role === "user" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] rounded-xl px-3 py-2.5 font-sans text-sm border",
                            msg.role === "user"
                              ? "bg-primary/10 text-foreground border-primary/20"
                              : "bg-card text-foreground border-border/30 shadow-soft"
                          )}
                        >
                          <p className="whitespace-pre-wrap leading-normal">{msg.content}</p>
                        </div>
                      </div>
                      
                      {/* Render confirmation UI if present */}
                      {msg.role === "assistant" && msg.ui && (
                        <div className="flex justify-start">
                          {(msg.ui.action === "confirm_create" || msg.ui.action === "confirm_reschedule") && onConfirmAction && (
                            <ConfirmationCard
                              message="" // Don't repeat the message
                              preview={msg.ui.task_preview || (msg.ui.task_id ? { id: msg.ui.task_id } : undefined)}
                              onConfirm={onConfirmAction}
                              onCancel={() => {
                                if (handleSendMessage) {
                                  handleSendMessage("no");
                                }
                              }}
                              isLoading={isLoading}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-card rounded-2xl p-4 border border-border/30 shadow-soft">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          <span className="text-xs font-sans text-muted-foreground">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border/50 shrink-0">
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
                  className="flex-1 py-3 px-4 bg-muted/50 rounded-xl text-foreground font-sans text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 border border-border/30"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen View - ChatGPT/Gemini style */}
      <CoreAIChat
        isOpen={isFullScreen}
        onClose={() => {
          setIsFullScreen(false);
          setIsOpen(false);
        }}
        messages={messages}
        onSendMessage={handleSendMessage}
        onConfirmAction={onConfirmAction}
        isLoading={isLoading}
        aiName={aiName}
        onClearHistory={onClearHistory}
        currentView={currentView}
        selectedTaskId={selectedTaskId}
        selectedDate={selectedDate}
      />
    </>
  );
}
