import { useState, useEffect, useRef } from "react";
import { X, CheckCircle2, Circle, ArrowRight, PartyPopper, Calendar, PenLine, Camera, Image, Trash2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { Task } from "@/types/lifeos";
import { ValueTag } from "./ValueTag";
import { cn } from "@/lib/utils";
import Confetti from "./Confetti";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onMoveTask: (id: string, newDate: Date) => void;
  onComplete: (completedIds: string[], incompleteIds: string[], movedTasks: { taskId: string; newDate: string }[], note?: string, mood?: string, photo?: { filename: string; uploadedAt: string } | null) => void;
  existingCheckIn?: {
    mood?: string;
    note?: string;
    completedTaskIds?: string[];
    incompleteTaskIds?: string[];
  };
  existingPhoto?: { filename: string; uploadedAt: string } | null;
}

export function CheckInModal({ 
  isOpen, 
  onClose, 
  date, 
  tasks, 
  onToggleTask,
  onMoveTask,
  onComplete,
  existingCheckIn,
  existingPhoto
}: CheckInModalProps) {
  const [step, setStep] = useState<"review" | "incomplete" | "reflection" | "celebration">("review");
  const [showConfetti, setShowConfetti] = useState(false);
  const [movedTasks, setMovedTasks] = useState<{ taskId: string; newDate: string }[]>([]);
  const [dailyNote, setDailyNote] = useState("");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [checkInPhoto, setCheckInPhoto] = useState<{ filename: string; uploadedAt: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const moodEmojis = [
    { emoji: "😊", label: "Great" },
    { emoji: "😌", label: "Good" },
    { emoji: "😐", label: "Okay" },
    { emoji: "😴", label: "Tired" },
  ];

  const completedTasks = tasks.filter(t => t.completed);
  const incompleteTasks = tasks.filter(t => !t.completed);
  const allCompleted = incompleteTasks.length === 0;
  const hasTasks = tasks.length > 0;

  useEffect(() => {
    if (isOpen) {
      setStep("review");
      setMovedTasks([]);
      // Pre-populate with existing check-in data if available
      setDailyNote(existingCheckIn?.note || "");
      setSelectedMood(existingCheckIn?.mood || null);
      setCheckInPhoto(existingPhoto || null);
    } else {
      // Reset when closed
      setStep("review");
      setMovedTasks([]);
      setDailyNote("");
      setSelectedMood(null);
      setCheckInPhoto(null);
      setShowConfetti(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  
  // Update fields when existing data changes (but only if modal is open)
  useEffect(() => {
    if (isOpen && existingCheckIn) {
      setDailyNote(existingCheckIn.note || "");
      setSelectedMood(existingCheckIn.mood || null);
    }
    if (isOpen && existingPhoto) {
      setCheckInPhoto(existingPhoto);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, existingCheckIn?.note, existingCheckIn?.mood, existingPhoto]);

  if (!isOpen) return null;

  const handleMoveTask = (taskId: string, daysToAdd: number) => {
    const newDate = addDays(date, daysToAdd);
    onMoveTask(taskId, newDate);
    setMovedTasks(prev => [...prev, { taskId, newDate: format(newDate, "yyyy-MM-dd") }]);
  };

  const handleContinue = () => {
    if (step === "review") {
      // If no tasks or all completed, go straight to reflection
      if (!hasTasks || allCompleted) {
        setStep("reflection");
      } else {
        setStep("incomplete");
      }
    } else if (step === "incomplete") {
      setStep("reflection");
    } else if (step === "reflection") {
      const completedIds = completedTasks.map(t => t.id);
      const incompleteIds = incompleteTasks.filter(t => !movedTasks.find(m => m.taskId === t.id)).map(t => t.id);
      onComplete(completedIds, incompleteIds, movedTasks, dailyNote, selectedMood || undefined, checkInPhoto);
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
      <div className="relative w-full max-w-lg bg-card rounded-t-3xl shadow-card animate-slide-up overflow-hidden h-[65vh] flex flex-col">
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
              <h3 className="font-semibold text-foreground font-sans">
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
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          {step === "review" && (
            <div className="space-y-3">
              <p className="text-sm font-sans text-muted-foreground mb-4">
                {hasTasks ? "Review your tasks and mark what you've completed." : "No tasks for today. Ready to reflect?"}
              </p>
              {hasTasks ? tasks.map(task => (
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
              )) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm font-sans">No tasks to review</p>
                </div>
              )}
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

              {/* Optional Photo Upload */}
              <div className="space-y-2">
                <p className="text-xs font-sans text-muted-foreground">Optional: Add a photo</p>
                {checkInPhoto ? (
                  <div className="relative group">
                    <div className="relative w-full h-64 rounded-xl overflow-hidden bg-muted/30">
                      <img
                        src={`${api.getPhotoUrl(checkInPhoto.filename)}?date=${format(date, "yyyy-MM-dd")}`}
                        alt="Check-in photo"
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setShowFullImage(true)}
                      />
                      <button
                        onClick={async (e) => {
                          e.stopPropagation(); // Prevent triggering image click
                          if (!confirm("Are you sure you want to delete this photo?")) {
                            return;
                          }
                          try {
                            const dateStr = format(date, "yyyy-MM-dd");
                            await api.deletePhoto(checkInPhoto.filename, dateStr);
                            setCheckInPhoto(null);
                            // Reset file input so user can add a new photo
                            if (fileInputRef.current) {
                              fileInputRef.current.value = "";
                            }
                            // Also update the note to remove photo reference immediately
                            // The note will be saved when check-in is completed, but we update it now too
                            try {
                              await api.saveNote({
                                date: dateStr,
                                content: dailyNote || "",
                                photo: null,
                              });
                            } catch (noteError) {
                              console.error("Failed to update note after photo deletion:", noteError);
                              // Don't show error to user - photo is deleted, note will sync on check-in completion
                            }
                          } catch (error) {
                            console.error("Failed to delete photo:", error);
                            alert("Failed to delete photo. Please try again.");
                          }
                        }}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:scale-105"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-4 rounded-xl bg-muted/50 hover:bg-muted border-2 border-dashed border-border/30 cursor-pointer transition-colors">
                    <Camera className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-sans text-muted-foreground">Add photo</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        if (!file.type.startsWith("image/")) {
                          alert("Please select an image file");
                          return;
                        }
                        
                        if (file.size > 10 * 1024 * 1024) {
                          alert("Image size must be less than 10MB");
                          return;
                        }
                        
                        setIsUploading(true);
                        try {
                          const dateStr = format(date, "yyyy-MM-dd");
                          const result = await api.uploadPhoto(file, dateStr);
                          setCheckInPhoto({
                            filename: result.filename,
                            uploadedAt: result.uploadedAt
                          });
                        } catch (error) {
                          console.error("Failed to upload photo:", error);
                          alert("Failed to upload photo. Please try again.");
                        } finally {
                          setIsUploading(false);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }
                      }}
                    />
                  </label>
                )}
                {isUploading && (
                  <p className="text-xs text-muted-foreground text-center">Uploading...</p>
                )}
              </div>
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

        {/* Full Screen Image Modal */}
        {showFullImage && checkInPhoto && (
          <div
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setShowFullImage(false)}
          >
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={`${api.getPhotoUrl(checkInPhoto.filename)}?date=${format(date, "yyyy-MM-dd")}`}
              alt="Check-in photo"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

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
