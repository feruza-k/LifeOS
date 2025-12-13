import { useState, useEffect } from "react";
import { X, CheckCircle2, Circle, ArrowRight, PartyPopper, Calendar, PenLine } from "lucide-react";
import { format, addDays } from "date-fns";
import { Task } from "@/types/lifeos";
import { ValueTag } from "./ValueTag";
import { cn } from "@/lib/utils";
import Confetti from "./Confetti";
import { Textarea } from "@/components/ui/textarea";

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onMoveTask: (id: string, newDate: Date) => void;
  onComplete: (completedIds: string[], incompleteIds: string[], movedTasks: { taskId: string; newDate: string }[], note?: string, mood?: string) => void;
}

export function CheckInModal({ 
  isOpen, 
  onClose, 
  date, 
  tasks, 
  onToggleTask,
  onMoveTask,
  onComplete 
}: CheckInModalProps) {
  const [step, setStep] = useState<"review" | "incomplete" | "reflection" | "celebration">("review");
  const [showConfetti, setShowConfetti] = useState(false);
  const [movedTasks, setMovedTasks] = useState<{ taskId: string; newDate: string }[]>([]);
  const [dailyNote, setDailyNote] = useState("");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  const moodEmojis = [
    { emoji: "😊", label: "Great" },
    { emoji: "😌", label: "Good" },
    { emoji: "😐", label: "Okay" },
    { emoji: "😴", label: "Tired" },
  ];

  const completedTasks = tasks.filter(t => t.completed);
  const incompleteTasks = tasks.filter(t => !t.completed);
  const allCompleted = incompleteTasks.length === 0;

  useEffect(() => {
    if (isOpen) {
      setStep("review");
      setMovedTasks([]);
      setDailyNote("");
      setSelectedMood(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMoveTask = (taskId: string, daysToAdd: number) => {
    const newDate = addDays(date, daysToAdd);
    onMoveTask(taskId, newDate);
    setMovedTasks(prev => [...prev, { taskId, newDate: format(newDate, "yyyy-MM-dd") }]);
  };

  const handleContinue = () => {
    if (step === "review") {
      if (allCompleted) {
        setStep("reflection");
      } else {
        setStep("incomplete");
      }
    } else if (step === "incomplete") {
      setStep("reflection");
    } else if (step === "reflection") {
      const completedIds = completedTasks.map(t => t.id);
      const incompleteIds = incompleteTasks.filter(t => !movedTasks.find(m => m.taskId === t.id)).map(t => t.id);
      onComplete(completedIds, incompleteIds, movedTasks, dailyNote, selectedMood || undefined);
      setStep("celebration");
      setShowConfetti(true);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {showConfetti && <Confetti />}
      <div 
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-card rounded-t-3xl shadow-card animate-slide-up overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              step === "celebration" ? "bg-tag-health/20" : "bg-primary/10"
            )}>
              {step === "celebration" ? (
                <PartyPopper className="w-5 h-5 text-tag-health" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <h3 className="font-serif font-semibold text-foreground">
                {step === "celebration" ? "Amazing work!" : "Daily Check-in"}
              </h3>
              <p className="text-xs font-sans text-muted-foreground">
                {format(date, "EEEE, MMMM d")}
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
        <div className="p-4 overflow-y-auto flex-1">
          {step === "review" && (
            <div className="space-y-3">
              <p className="text-sm font-sans text-muted-foreground mb-4">
                Review your tasks and mark what you've completed.
              </p>
              {tasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => onToggleTask(task.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                    task.completed 
                      ? "bg-primary/10" 
                      : "bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                    task.completed 
                      ? "bg-primary border-primary" 
                      : "border-muted-foreground/30"
                  )}>
                    {task.completed && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={cn(
                      "font-sans font-medium text-sm",
                      task.completed ? "text-foreground line-through" : "text-foreground"
                    )}>
                      {task.title}
                    </p>
                    {task.time && (
                      <p className="text-xs text-muted-foreground">{task.time}</p>
                    )}
                  </div>
                  <ValueTag value={task.value} size="sm" />
                </button>
              ))}
            </div>
          )}

          {step === "incomplete" && (
            <div className="space-y-4">
              <p className="text-sm font-sans text-muted-foreground">
                Would you like to move these incomplete tasks?
              </p>
              {incompleteTasks.map(task => {
                const isMoved = movedTasks.find(m => m.taskId === task.id);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "p-3 rounded-xl transition-all",
                      isMoved ? "bg-tag-health/10 opacity-60" : "bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn(
                        "w-1 h-8 rounded-full",
                        task.value === "health" && "bg-tag-health",
                        task.value === "growth" && "bg-primary",
                        task.value === "family" && "bg-tag-family",
                        task.value === "work" && "bg-tag-work",
                        task.value === "creativity" && "bg-tag-creativity"
                      )} />
                      <div className="flex-1">
                        <p className="font-sans font-medium text-sm text-foreground">
                          {task.title}
                        </p>
                        {task.time && (
                          <p className="text-xs text-muted-foreground">{task.time}</p>
                        )}
                      </div>
                    </div>
                    {!isMoved && (
                      <div className="flex gap-2 pl-4">
                        <button
                          onClick={() => handleMoveTask(task.id, 1)}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-accent text-xs font-sans font-medium text-accent-foreground hover:bg-accent/80 transition-colors flex items-center justify-center gap-1"
                        >
                          <Calendar className="w-3 h-3" />
                          Tomorrow
                        </button>
                        <button
                          onClick={() => handleMoveTask(task.id, 7)}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-muted text-xs font-sans font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
                        >
                          Next week
                        </button>
                      </div>
                    )}
                    {isMoved && (
                      <p className="text-xs text-tag-health font-sans pl-4">
                        ✓ Moved to {format(new Date(isMoved.newDate), "MMM d")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {step === "reflection" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <PenLine className="w-4 h-4 text-primary" />
                <p className="text-sm font-sans font-medium text-foreground">
                  How did today go?
                </p>
              </div>
              
              {/* Mood Selector */}
              <div className="flex justify-center gap-3 py-3">
                {moodEmojis.map((mood) => (
                  <button
                    key={mood.emoji}
                    onClick={() => setSelectedMood(mood.emoji)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-xl transition-all",
                      selectedMood === mood.emoji 
                        ? "bg-primary/10 ring-2 ring-primary" 
                        : "bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <span className="text-2xl">{mood.emoji}</span>
                    <span className="text-xs font-sans text-muted-foreground">{mood.label}</span>
                  </button>
                ))}
              </div>

              <p className="text-sm font-sans text-muted-foreground">
                Take a moment to reflect on your day.
              </p>
              <Textarea
                placeholder="Today I felt... I accomplished... Tomorrow I want to..."
                value={dailyNote}
                onChange={(e) => setDailyNote(e.target.value)}
                className="min-h-[100px] resize-none bg-muted/50 border-0 focus-visible:ring-primary/30"
              />
            </div>
          )}

          {step === "celebration" && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-xl font-serif font-semibold text-foreground mb-2">
                {allCompleted ? "All tasks completed!" : "Great progress today!"}
              </h3>
              <p className="text-sm font-sans text-muted-foreground">
                {allCompleted 
                  ? "You crushed it! Take a moment to appreciate your accomplishments."
                  : `You completed ${completedTasks.length} of ${tasks.length} tasks. Keep going!`
                }
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border shrink-0">
          <button
            onClick={handleContinue}
            className="w-full py-3 px-4 rounded-xl font-sans font-medium text-sm flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
          >
            {step === "review" && (
              <>
                Continue
                <ArrowRight className="w-4 h-4" />
              </>
            )}
            {step === "incomplete" && (
              <>
                Continue to Reflect
                <ArrowRight className="w-4 h-4" />
              </>
            )}
            {step === "reflection" && (
              <>
                Complete Check-in
                <ArrowRight className="w-4 h-4" />
              </>
            )}
            {step === "celebration" && "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
