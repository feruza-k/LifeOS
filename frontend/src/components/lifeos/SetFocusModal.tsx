import { useState } from "react";
import { X, Target, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface SetFocusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, description?: string) => void;
}

const suggestions = [
  "Build a consistent gym routine",
  "Read 2 books this month",
  "Learn a new skill",
  "Improve sleep habits",
  "Practice daily meditation",
  "Connect with family weekly",
];

export function SetFocusModal({ isOpen, onClose, onSave }: SetFocusModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  if (!isOpen) return null;

  const handleSave = () => {
    if (title.trim()) {
      onSave(title.trim(), description.trim() || undefined);
      setTitle("");
      setDescription("");
      onClose();
    }
  };

  const currentMonth = format(new Date(), "MMMM");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div 
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-card rounded-t-3xl shadow-card animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-foreground">
                {currentMonth} Focus
              </h3>
              <p className="text-xs font-sans text-muted-foreground">
                What's one thing to focus on this month?
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-sans font-medium text-foreground mb-2 block">
              Your focus
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Learn to code with AI"
              className="w-full py-3 px-4 bg-muted rounded-xl text-foreground font-sans text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-sans font-medium text-foreground mb-2 block">
              Why is this important? <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="This will help you stay motivated..."
              rows={2}
              className="w-full py-3 px-4 bg-muted rounded-xl text-foreground font-sans text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* Suggestions */}
          <div>
            <p className="text-xs font-sans font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Suggestions
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setTitle(suggestion)}
                  className="px-3 py-1.5 bg-accent rounded-full text-xs font-sans text-accent-foreground hover:bg-accent/80 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border">
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className={cn(
              "w-full py-3 px-4 rounded-xl font-sans font-medium text-sm flex items-center justify-center gap-2 transition-all",
              title.trim()
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Target className="w-4 h-4" />
            Set {currentMonth} Focus
          </button>
        </div>
      </div>
    </div>
  );
}
