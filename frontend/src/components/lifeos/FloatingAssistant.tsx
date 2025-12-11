import { useState } from "react";
import { Mic, X, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);

  return (
    <div className="fixed bottom-20 right-4 z-50">
      {/* AI Tooltip */}
      {showTooltip && !isOpen && (
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
              <span className="font-medium">Conflict detected</span> with your 7 PM meeting. Proposing 7:15 PM instead.
            </p>
          </div>
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setShowTooltip(false);
        }}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-fab transition-all duration-300",
          isOpen 
            ? "bg-card border border-border rotate-45" 
            : "bg-primary hover:scale-105"
        )}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-foreground" />
        ) : (
          <Mic className="w-6 h-6 text-primary-foreground" />
        )}
      </button>

      {/* Expanded Assistant Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-72 bg-card rounded-2xl shadow-card border border-border p-4 animate-scale-in">
          <h4 className="font-serif font-semibold text-foreground mb-2">
            Assistant Core
          </h4>
          <p className="text-sm text-muted-foreground font-sans mb-4">
            How can I help you organize your day?
          </p>
          <div className="space-y-2">
            <button className="w-full p-3 text-left text-sm font-sans bg-accent rounded-xl hover:bg-accent/80 transition-colors">
              ✨ Reschedule my afternoon
            </button>
            <button className="w-full p-3 text-left text-sm font-sans bg-accent rounded-xl hover:bg-accent/80 transition-colors">
              📋 Add a new task
            </button>
            <button className="w-full p-3 text-left text-sm font-sans bg-accent rounded-xl hover:bg-accent/80 transition-colors">
              🎯 Review my goals
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
