import { useState } from "react";
import { X, Target, Sparkles, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Goal {
  title: string;
  description: string;
}

interface SetFocusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (goals: Array<{ title: string; description?: string }>) => void;
  existingGoals?: Array<{ title: string; description?: string | null; id?: string }>;
}

const suggestions = [
  "Build a consistent gym routine",
  "Read 2 books this month",
  "Learn a new skill",
  "Improve sleep habits",
  "Practice daily meditation",
  "Connect with friends weekly",
];

export function SetFocusModal({ isOpen, onClose, onSave, existingGoals = [] }: SetFocusModalProps) {
  const [goals, setGoals] = useState<Goal[]>(() => {
    if (existingGoals.length > 0) {
      return existingGoals.map(g => ({ title: g.title, description: g.description || "" }));
    }
    return [{ title: "", description: "" }];
  });

  if (!isOpen) return null;

  const handleAddGoal = () => {
    if (goals.length < 5) {
      setGoals([...goals, { title: "", description: "" }]);
    }
  };

  const handleRemoveGoal = (index: number) => {
    if (goals.length > 1) {
      setGoals(goals.filter((_, i) => i !== index));
    }
  };

  const handleUpdateGoal = (index: number, field: "title" | "description", value: string) => {
    const updated = [...goals];
    updated[index] = { ...updated[index], [field]: value };
    setGoals(updated);
  };

  const handleSave = () => {
    const validGoals = goals
      .filter(g => g.title.trim())
      .map(g => ({
        title: g.title.trim(),
        description: g.description.trim() || undefined
      }));
    
    if (validGoals.length > 0) {
      onSave(validGoals);
      setGoals([{ title: "", description: "" }]);
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
              <h3 className="font-sans font-semibold text-foreground">
                {currentMonth} Goals
              </h3>
              <p className="text-xs font-sans text-muted-foreground">
                Set up to 5 goals for this month
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
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {goals.map((goal, index) => (
            <div key={index} className="p-4 bg-muted/50 rounded-xl space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-sans font-medium text-muted-foreground">
                  Goal {index + 1}
                </span>
                {goals.length > 1 && (
                  <button
                    onClick={() => handleRemoveGoal(index)}
                    className="p-1 rounded-full hover:bg-background transition-colors"
                    aria-label="Remove goal"
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              
              <div>
                <label className="text-sm font-sans font-medium text-foreground mb-2 block">
                  Your focus
                </label>
                <input
                  type="text"
                  value={goal.title}
                  onChange={(e) => handleUpdateGoal(index, "title", e.target.value)}
                  placeholder="e.g., Learn to code with AI"
                  className="w-full py-3 px-4 bg-background rounded-xl text-foreground font-sans text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  autoFocus={index === 0}
                />
              </div>

              <div>
                <label className="text-sm font-sans font-medium text-foreground mb-2 block">
                  Why is this important? <span className="text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  value={goal.description}
                  onChange={(e) => handleUpdateGoal(index, "description", e.target.value)}
                  placeholder="This will help you stay motivated..."
                  rows={2}
                  className="w-full py-3 px-4 bg-background rounded-xl text-foreground font-sans text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>
          ))}

          {goals.length < 5 && (
            <button
              onClick={handleAddGoal}
              className="w-full py-3 px-4 border-2 border-dashed border-muted-foreground/30 rounded-xl text-muted-foreground font-sans text-sm flex items-center justify-center gap-2 hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add another goal ({goals.length}/5)
            </button>
          )}

          {/* Suggestions */}
          {goals.length === 1 && goals[0].title === "" && (
            <div>
              <p className="text-xs font-sans font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Suggestions
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleUpdateGoal(0, "title", suggestion)}
                    className="px-3 py-1.5 bg-accent rounded-full text-xs font-sans text-accent-foreground hover:bg-accent/80 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border">
          <Button
            onClick={handleSave}
            disabled={!goals.some(g => g.title.trim())}
            className="w-full font-sans"
          >
            <Target className="w-4 h-4 mr-2" />
            Save {currentMonth} Goals
          </Button>
        </div>
      </div>
    </div>
  );
}
