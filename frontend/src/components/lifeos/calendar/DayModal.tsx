import { useState, useEffect, useRef } from "react";
import { format, isSameDay, addDays, subDays, isBefore, isAfter, startOfDay } from "date-fns";
import { X, Check, Camera, Image, Edit3, Plus, Trash2, Heart, Sparkles } from "lucide-react";
import { Task } from "../TaskItem";
import { cn } from "@/lib/utils";
import { useSwipeable } from "react-swipeable";
import { api } from "@/lib/api";
import { useLifeOSStore } from "@/stores/useLifeOSStore";

interface DayModalProps {
  date: Date;
  tasks: Task[];
  note: string;
  photo?: { filename: string; uploadedAt: string } | null;
  checkIn?: {
    mood?: string;
    completedTaskIds?: string[];
    note?: string;
  };
  completedCount?: number;
  totalTasksCount?: number;
  onClose: () => void;
  onToggleTask: (id: string) => void;
  onSaveNote: (content: string) => void;
  onDateChange?: (date: Date) => void;
  onAddTask?: (date: Date) => void;
  onPhotoChange?: (photo: { filename: string; uploadedAt: string } | null) => void;
  onUpdateCheckIn?: (checkIn: { note?: string; mood?: string }) => Promise<void>;
}

type TabType = "tasks" | "photo-notes";

export function DayModal({ 
  date, 
  tasks, 
  note,
  photo = null,
  checkIn,
  completedCount = 0,
  totalTasksCount = 0,
  onClose, 
  onToggleTask,
  onSaveNote,
  onDateChange,
  onAddTask,
  onPhotoChange,
  onUpdateCheckIn
}: DayModalProps) {
  const store = useLifeOSStore();
  // Safely check if date is valid (before hooks)
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    console.error("DayModal: Invalid date prop", date);
    return null;
  }
  
  // Calculate date states before hooks
  const isToday = isSameDay(date, new Date());
  const isPast = isBefore(startOfDay(date), startOfDay(new Date())) && !isToday;
  const isFuture = isAfter(startOfDay(date), startOfDay(new Date()));
  
  // Initialize with first available tab
  const [activeTab, setActiveTab] = useState<TabType>("tasks");
  
  // Reset to tasks if photo-notes tab becomes unavailable
  useEffect(() => {
    if (isFuture && activeTab === "photo-notes") {
      setActiveTab("tasks");
    }
  }, [isFuture, activeTab]);
  
  // Merged note content: prefer check-in reflection, fallback to regular note
  const getMergedNoteContent = () => {
    return checkIn?.note || note || "";
  };
  
  const [noteContent, setNoteContent] = useState(getMergedNoteContent());
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [dayPhoto, setDayPhoto] = useState<{ filename: string; uploadedAt: string } | null>(photo);
  const [isUploading, setIsUploading] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update note content when note or checkIn prop changes (but not when editing)
  useEffect(() => {
    if (!isEditingNote) {
      setNoteContent(getMergedNoteContent());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note, checkIn?.note, isEditingNote]);

  // Update photo when photo prop changes
  useEffect(() => {
    setDayPhoto(photo || null);
  }, [photo]);

  // Only show photo-notes tab for past and today, not for future days
  const tabs: TabType[] = isFuture ? ["tasks"] : ["tasks", "photo-notes"];

  const handleSaveNote = async () => {
    // If there's a check-in reflection, update it; otherwise save as regular note
    if (checkIn?.note && onUpdateCheckIn) {
      await onUpdateCheckIn({ note: noteContent, mood: checkIn.mood });
    } else {
      onSaveNote(noteContent);
    }
    setIsEditingNote(false);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("Image size must be less than 10MB");
      return;
    }

    setIsUploading(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const result = await api.uploadPhoto(file, dateStr);
      
      const newPhoto = {
        filename: result.filename,
        uploadedAt: result.uploadedAt
      };
      
      setDayPhoto(newPhoto);
      
      if (onPhotoChange) {
        onPhotoChange(newPhoto);
      }
    } catch (error) {
      console.error("Failed to upload photo:", error);
      alert("Failed to upload photo. Please try again.");
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeletePhoto = async () => {
    if (!dayPhoto) return;
    
    if (!confirm("Are you sure you want to delete this photo?")) {
      return;
    }

    try {
      const dateStr = format(date, "yyyy-MM-dd");
      await api.deletePhoto(dayPhoto.filename, dateStr);
      
      setDayPhoto(null);
      
      if (onPhotoChange) {
        onPhotoChange(null);
      }
    } catch (error) {
      console.error("Failed to delete photo:", error);
      alert("Failed to delete photo. Please try again.");
    }
  };

  // Swipe handlers for tabs
  const tabSwipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      const currentIndex = tabs.indexOf(activeTab);
      if (currentIndex < tabs.length - 1) {
        setActiveTab(tabs[currentIndex + 1]);
      }
    },
    onSwipedRight: () => {
      const currentIndex = tabs.indexOf(activeTab);
      if (currentIndex > 0) {
        setActiveTab(tabs[currentIndex - 1]);
      }
    },
    trackMouse: false,
    trackTouch: true,
  });

  // Swipe handlers for day navigation (only on header area)
  const headerSwipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (onDateChange) {
        onDateChange(addDays(date, 1));
      }
    },
    onSwipedRight: () => {
      if (onDateChange) {
        onDateChange(subDays(date, 1));
      }
    },
    trackMouse: false,
    trackTouch: true,
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card rounded-3xl shadow-card w-full max-w-sm animate-scale-in overflow-hidden">
        {/* Header - Swipeable for day navigation */}
        <div {...headerSwipeHandlers} className="flex items-center justify-between p-4 border-b border-border/50">
          <div>
            <h3 className="font-sans text-lg font-semibold text-foreground">
              {isToday ? "Today" : format(date, "EEEE")}
            </h3>
            <p className="text-xs text-muted-foreground font-sans">
              {format(date, "MMMM d, yyyy")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Tab Indicators - Only show if there are multiple tabs */}
        {tabs.length > 1 && (
          <div className="flex justify-center gap-1.5 py-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  activeTab === tab ? "bg-primary w-4" : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        )}

        {/* Content */}
        <div className="min-h-[280px] max-h-[320px] overflow-y-auto">
          {/* Tasks Tab */}
          {activeTab === "tasks" && (
            <div {...tabSwipeHandlers} className="p-4 space-y-2">
              {/* Completed count header */}
              {totalTasksCount > 0 && (
                <div className="mb-3 pb-3 border-b border-border/30">
                  <p className="text-xs font-sans text-muted-foreground">
                    {completedCount} of {totalTasksCount} tasks completed
                  </p>
                  <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${totalTasksCount > 0 ? (completedCount / totalTasksCount * 100) : 0}%` }}
                    />
                  </div>
                </div>
              )}
              {tasks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground font-sans mb-4">
                    No tasks scheduled
                  </p>
                  {onAddTask && (
                    <button
                      onClick={() => onAddTask(date)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-sans text-sm font-medium transition-all hover:opacity-90"
                    >
                      <Plus className="w-4 h-4" />
                      Add Task
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {[...tasks].sort((a, b) => {
                    // Scheduled tasks (with time) come first
                    const aIsScheduled = !!a.time;
                    const bIsScheduled = !!b.time;
                    if (aIsScheduled && !bIsScheduled) return -1;
                    if (!aIsScheduled && bIsScheduled) return 1;
                    // If both are same type, maintain original order
                    return 0;
                  }).map((task) => (
                    <button
                      key={task.id}
                      onClick={() => onToggleTask(task.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 transition-all text-left",
                        task.completed && "opacity-50"
                      )}
                    >
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                          task.completed
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/40"
                        )}
                      >
                        {task.completed && (
                          <Check className="w-3 h-3 text-primary-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 relative">
                        {/* Subtle category accent bar */}
                        {(() => {
                          const category = store.categories.find(c => c.id === task.value);
                          const categoryColor = category?.color;
                          return categoryColor ? (
                            <div 
                              className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full"
                              style={{ backgroundColor: categoryColor }}
                            />
                          ) : null;
                        })()}
                        <div className="pl-2">
                          <p className={cn(
                            "font-sans text-sm font-medium text-foreground truncate",
                            task.completed && "line-through text-muted-foreground"
                          )}>
                            {task.title}
                          </p>
                          {task.time && (
                            <p className="text-xs text-muted-foreground">{task.time}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                  {onAddTask && (
                    <button
                      onClick={() => onAddTask(date)}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all text-muted-foreground hover:text-foreground font-sans text-sm font-medium border border-dashed border-border/50"
                    >
                      <Plus className="w-4 h-4" />
                      Add Task
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Photo & Notes Tab */}
          {activeTab === "photo-notes" && (
            <div {...tabSwipeHandlers} className="p-4 space-y-4">
              {/* Photo Section */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                
                {!dayPhoto ? (
                  <div className={cn(
                    "flex flex-col items-center justify-center py-8 text-center rounded-2xl transition-all",
                    isPast 
                      ? "bg-gradient-to-br from-muted/30 via-muted/20 to-muted/30 border border-dashed border-muted-foreground/20"
                      : "border border-dashed border-primary/30 bg-primary/5"
                  )}>
                    {isPast ? (
                      <>
                        <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mb-4 relative">
                          <Heart className="w-7 h-7 text-muted-foreground/40" />
                          <Sparkles className="w-4 h-4 text-primary/40 absolute -top-1 -right-1" />
                        </div>
                        <p className="text-muted-foreground font-sans text-sm mb-1 font-medium">
                          This day is camera-shy! ✨
                        </p>
                        <p className="text-muted-foreground/60 font-sans text-xs">
                          Photos can only be added to today
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                          <Camera className="w-7 h-7 text-primary" />
                        </div>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-sans text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shadow-sm"
                        >
                          <Camera className="w-4 h-4" />
                          {isUploading ? "Uploading..." : "Add Photo"}
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="relative group">
                    <div 
                      onClick={() => setShowFullImage(true)}
                      className="cursor-pointer overflow-hidden rounded-2xl shadow-md hover:shadow-lg transition-shadow"
                    >
                      <img
                        src={api.getPhotoUrl(dayPhoto.filename)}
                        alt={`Photo from ${format(date, "MMM d")}`}
                        className="w-full aspect-video object-cover"
                      />
                    </div>
                    {isToday && (
                      <div className="absolute top-3 right-3 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          disabled={isUploading}
                          className="w-9 h-9 rounded-full bg-background/95 backdrop-blur-sm text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50 shadow-md hover:scale-105"
                          title="Retake photo"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePhoto();
                          }}
                          className="w-9 h-9 rounded-full bg-destructive/95 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md hover:scale-105"
                          title="Delete photo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes Section - Smart merged display */}
              <div className="space-y-4">
                <div className={cn(
                  "rounded-2xl p-4 border transition-colors",
                  checkIn?.mood || checkIn?.note 
                    ? "bg-gradient-to-br from-primary/5 to-primary/10 border-primary/10" 
                    : "bg-muted/30 border-border/20"
                )}>
                  {isEditingNote ? (
                    <div className="space-y-3">
                      <textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Write your thoughts for this day..."
                        className="w-full min-h-[120px] bg-background/50 rounded-xl p-4 text-sm font-sans text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 border border-border/30"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setNoteContent(getMergedNoteContent());
                            setIsEditingNote(false);
                          }}
                          className="flex-1 py-2.5 rounded-xl bg-muted/50 hover:bg-muted text-foreground font-sans text-sm font-medium transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveNote}
                          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-sans text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Mood indicator - subtle, only if mood exists */}
                      {checkIn?.mood && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{checkIn.mood}</span>
                          {checkIn.note && (
                            <span className="text-[10px] font-sans text-muted-foreground/60 font-medium">Reflection</span>
                          )}
                        </div>
                      )}
                      
                      {noteContent ? (
                        <div className="min-h-[60px]">
                          <p className="text-sm font-sans text-foreground whitespace-pre-wrap leading-relaxed">
                            {noteContent}
                          </p>
                          {/* Show regular note separately if both exist */}
                          {checkIn?.note && note && checkIn.note !== note && (
                            <div className="mt-4 pt-4 border-t border-border/20">
                              <p className="text-xs font-sans font-medium text-muted-foreground/70 mb-2">Additional note</p>
                              <p className="text-sm font-sans text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                {note}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-4 text-center">
                          <p className="text-muted-foreground font-sans text-sm">
                            No reflection yet
                          </p>
                        </div>
                      )}
                      
                      <button
                        onClick={() => setIsEditingNote(true)}
                        className="w-full py-2 rounded-xl bg-muted/50 hover:bg-muted text-foreground font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <Edit3 className="w-4 h-4" />
                        {noteContent ? "Edit Reflection" : "Add Reflection"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Full Screen Image Modal */}
      {showFullImage && dayPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowFullImage(false)}
        >
          <div className="relative max-w-full max-h-full">
            <img
              src={api.getPhotoUrl(dayPhoto.filename)}
              alt={`Photo from ${format(date, "MMM d")}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-background/95 backdrop-blur-sm text-foreground flex items-center justify-center hover:bg-background transition-colors shadow-lg"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}