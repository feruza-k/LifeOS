import { useState, useEffect } from "react";
import { X, BookOpen, Save } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DailyNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  initialContent?: string;
  onSave: (content: string) => void;
}

export function DailyNoteModal({ isOpen, onClose, date, initialContent = "", onSave }: DailyNoteModalProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    setIsSaving(true);
    onSave(content);
    setTimeout(() => {
      setIsSaving(false);
      onClose();
    }, 300);
  };

  const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

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
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-foreground">
                {isToday ? "Today's Note" : "Daily Note"}
              </h3>
              <p className="text-xs font-sans text-muted-foreground">
                {format(date, "EEEE, MMMM d, yyyy")}
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
        <div className="p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="How was your day? What did you accomplish? How are you feeling?"
            className="w-full h-48 p-4 bg-accent/30 rounded-xl text-foreground font-sans text-sm placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            autoFocus
          />
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "w-full py-3 px-4 rounded-xl font-sans font-medium text-sm flex items-center justify-center gap-2 transition-all",
              isSaving
                ? "bg-primary/50 text-primary-foreground/70"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Note"}
          </button>
        </div>
      </div>
    </div>
  );
}
