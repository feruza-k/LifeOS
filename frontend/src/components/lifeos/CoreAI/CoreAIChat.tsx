import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, Loader2, Trash2, MessageSquare, Plus, Copy, Check, ThumbsUp, ThumbsDown, Download, Search, HelpCircle, Wifi, WifiOff, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConversationMessage } from "@/types/lifeos";
import { formatMessageTime } from "@/utils/timeUtils";
import { ConfirmationCard } from "./ConfirmationCard";
import { useLifeOSStore } from "@/stores/useLifeOSStore";
import { api } from "@/lib/api";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { toast } from "sonner";
import { i18n } from "@/utils/i18n";

interface CoreAIChatProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ConversationMessage[];
  onSendMessage: (message: string) => void;
  onConfirmAction?: () => void;
  isLoading?: boolean;
  aiName?: string;
  onClearHistory?: () => void;
  currentView?: string;
  selectedTaskId?: string;
  selectedDate?: string;
}

export function CoreAIChat({ 
  isOpen, 
  onClose, 
  messages, 
  onSendMessage, 
  onConfirmAction,
  isLoading = false,
  aiName = "SolAI",
  onClearHistory,
  currentView = "today",
  selectedTaskId,
  selectedDate
}: CoreAIChatProps) {
  const store = useLifeOSStore();
  const [input, setInput] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, "up" | "down">>({});
  const [contextActions, setContextActions] = useState<any[]>([]);
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "error">("connected");
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Load chat history from store
  const chatHistory = store.chatHistory || [];

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onOpen: () => {
      if (!isOpen) {
        // This would need to be handled by parent
      }
    },
    onClose: () => isOpen && onClose(),
    onShowHelp: () => setShowHelp(!showHelp),
  });

  // Load context actions
  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen, currentView, selectedTaskId, selectedDate]);

  // Generate suggested follow-ups after assistant messages
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        // Generate follow-up suggestions based on message content
        const suggestions: string[] = [];
        const content = lastMessage.content.toLowerCase();
        
        if (content.includes("task") || content.includes("schedule")) {
          suggestions.push("Show me my schedule");
          suggestions.push("What else do I have today?");
        }
        if (content.includes("conflict")) {
          suggestions.push("Resolve all conflicts");
          suggestions.push("Show me my calendar");
        }
        if (content.includes("focus") || content.includes("today")) {
          suggestions.push("What should I prioritize?");
          suggestions.push("Show my progress");
        }
        
        // Default suggestions
        if (suggestions.length === 0) {
          suggestions.push("Tell me more");
          suggestions.push("What else can you help with?");
        }
        
        setSuggestedFollowUps(suggestions.slice(0, 3));
      } else {
        setSuggestedFollowUps([]);
      }
    }
  }, [messages, isLoading]);

  // Auto-scroll handling
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  // Check if user scrolled up
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setAutoScroll(isNearBottom);
      setShowScrollButton(!isNearBottom && messages.length > 3);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [messages.length]);

  // Connection status check
  useEffect(() => {
    const checkConnection = async () => {
      try {
        setConnectionStatus("connecting");
        // Simple health check - try to get context actions
        await api.getContextActions(currentView, selectedTaskId, selectedDate);
        setConnectionStatus("connected");
      } catch (error) {
        setConnectionStatus("error");
      }
    };
    
    if (isOpen) {
      checkConnection();
      const interval = setInterval(checkConnection, 30000); // Check every 30s
      return () => clearInterval(interval);
    }
  }, [isOpen, currentView, selectedTaskId, selectedDate]);

  useEffect(() => {
    // Auto-show sidebar on desktop
    if (isOpen && window.innerWidth >= 768) {
      setShowSidebar(true);
    }
  }, [isOpen]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput("");
      setAutoScroll(true);
    }
  };

  // Voice Input (Speech-to-Text)
  const startVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
      recognition.stop();
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === "no-speech") {
        toast.error("No speech detected. Please try again.");
      } else {
        toast.error("Speech recognition failed. Please try again.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceInput();
    };
  }, []);

  const handleCopyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
      toast.success("Copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const handleExportConversation = () => {
    const text = messages.map(msg => {
      const role = msg.role === "user" ? "You" : aiName;
      const time = formatMessageTime(msg.timestamp);
      return `[${time}] ${role}: ${msg.content}`;
    }).join("\n\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifeos-conversation-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Conversation exported");
  };

  const handleSaveChat = () => {
    if (messages.length === 0) return;
    const title = messages.find(m => m.role === "user")?.content.slice(0, 50) || "New Chat";
    store.saveChatToHistory(title);
    toast.success("Chat saved to history");
  };

  const handleLoadChat = (chatId: string) => {
    store.loadChatFromHistory(chatId);
    setShowSidebar(false);
    toast.success("Chat loaded");
  };

  const handleDeleteChat = (chatId: string) => {
    store.deleteChatFromHistory(chatId);
    toast.success("Chat deleted");
  };

  const filteredChatHistory = searchQuery
    ? chatHistory.filter(chat => 
        chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.messages.some((m: ConversationMessage) => 
          m.content.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : chatHistory;

  // Get today's stats for empty state
  const todayStats = store.today ? {
    taskCount: store.today.tasks?.length || 0,
    energy: store.today.energy,
    conflicts: store.today.conflicts || []
  } : null;

  // Check if speech recognition is available
  const hasSpeechRecognition = typeof window !== 'undefined' && 
    (('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-background">
      {/* Mobile backdrop for sidebar */}
      {showSidebar && (
        <div 
          className="md:hidden absolute inset-0 bg-foreground/20 backdrop-blur-sm z-10"
          onClick={() => setShowSidebar(false)}
        />
      )}
      
      {/* Sidebar - Chat History */}
      {showSidebar && (
        <div className="absolute md:relative inset-y-0 left-0 w-64 border-r border-border/50 bg-card flex flex-col shrink-0 z-20 md:z-auto shadow-lg md:shadow-none">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-border/50">
            <button
              onClick={() => {
                onClearHistory?.();
                handleSaveChat();
                setSearchQuery("");
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20 mb-3"
            >
              <Plus className="w-4 h-4 text-primary" />
              <span className="text-sm font-sans font-medium text-foreground">New Chat</span>
            </button>
            
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-muted/50 rounded-xl border border-border/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            
            <h3 className="text-xs font-sans font-semibold text-muted-foreground uppercase tracking-wide px-2">
              Recent Chats
            </h3>
          </div>
          
          {/* Chat History List */}
          <div className="flex-1 overflow-y-auto p-2">
            {filteredChatHistory.length === 0 ? (
              <div className="text-center py-8 px-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-xs font-sans text-muted-foreground">
                  {searchQuery ? "No chats found" : "No previous chats"}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredChatHistory.map((chat) => (
                  <div
                    key={chat.id}
                    className="group relative p-3 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border/30"
                  >
                    <button
                      onClick={() => handleLoadChat(chat.id)}
                      className="w-full text-left"
                    >
                      <p className="text-sm font-sans font-medium text-foreground truncate mb-1">
                        {chat.title}
                      </p>
                      <p className="text-xs font-sans text-muted-foreground">
                        {formatMessageTime(chat.date)}
                      </p>
                    </button>
                    <button
                      onClick={() => handleDeleteChat(chat.id)}
                      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 transition-opacity"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Contextual Info Panel */}
        {(contextActions.length > 0 || todayStats) && messages.length === 0 && (
          <div className="p-3 bg-primary/5 border-b border-primary/10">
            {contextActions.filter(a => a.priority === "high").map((action) => (
              <button
                key={action.id}
                onClick={() => onSendMessage(action.label)}
                className="w-full text-left p-2 rounded-lg hover:bg-primary/10 transition-colors mb-2 last:mb-0"
              >
                <p className="text-sm font-sans font-medium text-foreground">{action.label}</p>
                {action.description && (
                  <p className="text-xs font-sans text-muted-foreground mt-0.5">{action.description}</p>
                )}
              </button>
            ))}
            {todayStats && (
              <div className="text-xs font-sans text-muted-foreground mt-2">
                {todayStats.taskCount > 0 && (
                  <span>{todayStats.taskCount} task{todayStats.taskCount !== 1 ? "s" : ""} today</span>
                )}
                {todayStats.conflicts && todayStats.conflicts.length > 0 && (
                  <span className="ml-2 text-primary">{todayStats.conflicts.length} conflict{todayStats.conflicts.length !== 1 ? "s" : ""}</span>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
              title="Toggle chat history"
            >
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-sans font-bold text-foreground">{aiName}</h2>
              <div className="flex items-center gap-2">
                <p className="text-xs font-sans text-muted-foreground">Your personal assistant</p>
                {/* Connection Status */}
                <div className="flex items-center gap-1">
                  {connectionStatus === "connected" && (
                    <Wifi className="w-3 h-3 text-primary" title="Connected" />
                  )}
                  {connectionStatus === "connecting" && (
                    <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" title="Connecting..." />
                  )}
                  {connectionStatus === "error" && (
                    <WifiOff className="w-3 h-3 text-destructive" title="Connection error" />
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <>
                <button
                  onClick={handleExportConversation}
                  className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                  title="Export conversation"
                >
                  <Download className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  onClick={handleSaveChat}
                  className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                  title="Save chat"
                >
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </button>
              </>
            )}
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
              onClick={() => setShowHelp(!showHelp)}
              className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
              title="Keyboard shortcuts"
            >
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </button>
        <button
          onClick={onClose}
              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
          </div>
      </header>

        {/* Help Modal */}
        {showHelp && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl p-6 max-w-md w-full border border-border/30 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-sans font-bold text-foreground">Keyboard Shortcuts</h3>
                <button
                  onClick={() => setShowHelp(false)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="space-y-2 text-sm font-sans">
                <div className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/50">
                  <span className="text-foreground">Open assistant</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">⌘K</kbd>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/50">
                  <span className="text-foreground">Close assistant</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">Esc</kbd>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/50">
                  <span className="text-foreground">Send message</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/50">
                  <span className="text-foreground">Show help</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">⌘/</kbd>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Messages */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 relative"
        >
        {messages.length === 0 ? (
          <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/20">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
              <h3 className="font-sans text-lg font-bold text-foreground mb-2">
              Hey there! I'm {aiName}
            </h3>
              <p className="text-base text-muted-foreground font-sans max-w-xs mx-auto mb-6">
                {i18n.t("solai.greeting")}
            </p>
            
              {/* Context-aware quick actions */}
            <div className="space-y-2 max-w-sm mx-auto">
                {contextActions.length > 0 ? (
                  contextActions.slice(0, 3).map((action) => (
                    <button
                      key={action.id}
                      onClick={() => onSendMessage(action.label)}
                      className="w-full p-3 text-left text-base font-sans bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-border/30"
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
                      onClick={() => onSendMessage(action.label)}
                      className="w-full p-3 text-left text-base font-sans bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-border/30"
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
                <div key={msg.id} className="space-y-1.5 group">
              <div
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                        "max-w-[80%] rounded-xl px-3 py-2.5 font-sans text-sm border relative",
                    msg.role === "user"
                          ? "bg-primary/10 text-foreground border-primary/20"
                          : "bg-card text-foreground border-border/30 shadow-soft"
                      )}
                    >
                      {/* Copy button - appears on hover */}
                      {msg.role === "assistant" && (
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-muted transition-opacity"
                          title="Copy message"
                        >
                          {copiedMessageId === msg.id ? (
                            <Check className="w-3 h-3 text-primary" />
                          ) : (
                            <Copy className="w-3 h-3 text-muted-foreground" />
                          )}
                        </button>
                      )}
                      
                      <p className="whitespace-pre-wrap leading-normal pr-7">{msg.content}</p>
                      {/* Message reactions */}
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1 mt-2">
                          <button
                              onClick={() => {
                                setMessageReactions(prev => ({
                                  ...prev,
                                  [msg.id]: prev[msg.id] === "up" ? undefined : "up"
                                }));
                              }}
                              className={cn(
                                "p-1 rounded hover:bg-muted transition-colors",
                                messageReactions[msg.id] === "up" && "bg-primary/10"
                              )}
                            >
                              <ThumbsUp className={cn(
                                "w-3 h-3",
                                messageReactions[msg.id] === "up" ? "text-primary" : "text-muted-foreground"
                              )} />
                            </button>
                            <button
                              onClick={() => {
                                setMessageReactions(prev => ({
                                  ...prev,
                                  [msg.id]: prev[msg.id] === "down" ? undefined : "down"
                                }));
                              }}
                              className={cn(
                                "p-1 rounded hover:bg-muted transition-colors",
                                messageReactions[msg.id] === "down" && "bg-destructive/10"
                              )}
                            >
                              <ThumbsDown className={cn(
                                "w-3 h-3",
                                messageReactions[msg.id] === "down" ? "text-destructive" : "text-muted-foreground"
                              )} />
                            </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Render confirmation UI if present - don't show message bubble if there's a confirmation UI */}
                  {msg.role === "assistant" && msg.ui && (
                    <div className="flex justify-start">
                      {(msg.ui.action === "confirm_create" || msg.ui.action === "confirm_reschedule") && onConfirmAction && (
                        <ConfirmationCard
                          message="" // Don't repeat the message - it's already in the chat bubble above
                          preview={msg.ui.task_preview || (msg.ui.task_id ? { id: msg.ui.task_id } : undefined)}
                          onConfirm={onConfirmAction}
                          onCancel={() => {
                            if (onSendMessage) {
                              onSendMessage("no");
                            }
                          }}
                          isLoading={isLoading}
                        />
                      )}
                    </div>
                  )}
                  
                  {/* Suggested follow-ups after assistant messages */}
                  {msg.role === "assistant" && 
                   msg.id === messages[messages.length - 1]?.id && 
                   suggestedFollowUps.length > 0 && 
                   !isLoading && (
                    <div className="flex justify-start flex-wrap gap-2 mt-2">
                      {suggestedFollowUps.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => onSendMessage(suggestion)}
                          className="px-3 py-1.5 text-sm font-sans bg-muted/50 rounded-lg hover:bg-muted transition-colors border border-border/30 text-foreground"
                        >
                          {suggestion}
                        </button>
                      ))}
                </div>
                  )}
              </div>
            ))}
              
            {isLoading && (
              <div className="flex justify-start">
                  <div className="bg-card rounded-2xl p-4 border border-border/30 shadow-soft">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-xs font-sans text-muted-foreground">{i18n.t("solai.thinking")}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Scroll to bottom button */}
              {showScrollButton && (
                <button
                  onClick={() => {
                    setAutoScroll(true);
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="fixed bottom-24 right-4 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-fab hover:bg-primary/90 transition-colors z-10"
                  title="Scroll to bottom"
                >
                  <Send className="w-4 h-4 rotate-180" />
                </button>
              )}
              
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-border/50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              disabled={isLoading || isListening}
              className={cn(
                "w-full py-3 px-4 bg-muted/50 rounded-xl text-foreground font-sans text-lg placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 border border-border/30",
                hasSpeechRecognition ? "pr-12" : "pr-4"
              )}
            />
              {/* Voice input button - only show if supported */}
              {hasSpeechRecognition && (
            <button
              type="button"
                  onClick={isListening ? stopVoiceInput : startVoiceInput}
                  disabled={isLoading}
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all z-10",
                    isListening
                      ? "bg-destructive text-destructive-foreground animate-pulse"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                  title={isListening ? "Stop listening" : "Voice input"}
                >
                  {isListening ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
            </button>
              )}
          </div>
            <button
            type="submit"
              disabled={!input.trim() || isLoading || isListening}
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                input.trim() && !isLoading && !isListening
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
          {isListening && (
            <div className="mt-2 flex items-center gap-2 text-sm text-primary">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-sans">{i18n.t("solai.voice.listen")}</span>
            </div>
          )}
      </form>
      </div>
    </div>
  );
}
