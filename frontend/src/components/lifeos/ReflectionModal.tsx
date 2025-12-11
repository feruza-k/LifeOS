import { useState } from "react";
import { X, Star, Smile, Meh, Frown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ReflectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const moods = [
  { icon: Smile, label: "Great", value: "great" },
  { icon: Meh, label: "Okay", value: "okay" },
  { icon: Frown, label: "Tough", value: "tough" },
];

export function ReflectionModal({ isOpen, onClose }: ReflectionModalProps) {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [reflection, setReflection] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div 
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md bg-card rounded-t-3xl p-6 pb-safe animate-slide-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="text-center mb-6">
          <Star className="w-10 h-10 text-primary mx-auto mb-3" />
          <h2 className="text-xl font-serif font-semibold text-foreground">
            Evening Reflection
          </h2>
          <p className="text-sm text-muted-foreground font-sans mt-1">
            How was your day?
          </p>
        </div>

        <div className="flex justify-center gap-4 mb-6">
          {moods.map((mood) => (
            <button
              key={mood.value}
              onClick={() => setSelectedMood(mood.value)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-200",
                selectedMood === mood.value 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-accent text-foreground hover:bg-accent/80"
              )}
            >
              <mood.icon className="w-8 h-8" />
              <span className="text-sm font-sans font-medium">{mood.label}</span>
            </button>
          ))}
        </div>

        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="What's one thing you're grateful for today?"
          className="w-full h-24 p-4 bg-muted rounded-xl text-foreground font-sans text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
        />

        <Button
          onClick={onClose}
          className="w-full h-12 mt-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-sans font-medium"
        >
          Complete Reflection
        </Button>
      </div>
    </div>
  );
}
