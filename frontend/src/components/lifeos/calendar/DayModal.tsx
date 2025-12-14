import { useState, useEffect } from "react";
import { format, isSameDay, addDays, subDays } from "date-fns";
import { X, Check, Camera, Image, Edit3, Plus } from "lucide-react";
import { Task } from "../TaskItem";
import { ValueTag } from "../ValueTag";
import { cn } from "@/lib/utils";
import { useSwipeable } from "react-swipeable";

interface DayModalProps {
  date: Date;
  tasks: Task[];
  note: string;
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
}

type TabType = "tasks" | "notes" | "photo";

export function DayModal({ 
  date, 
  tasks, 
  note,
  checkIn,
  completedCount = 0,
  totalTasksCount = 0,
  onClose, 
  onToggleTask,
  onSaveNote,
  onDateChange,
  onAddTask
}: DayModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("tasks");
  // Note content (separate from check-in note which is shown in check-in section)
  const [noteContent, setNoteContent] = useState(note);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const isToday = isSameDay(date, new Date());

  // Update note content when note prop changes (but not when editing)
  useEffect(() => {
    if (!isEditingNote) {
      setNoteContent(note);
    }
  }, [note, isEditingNote]);

  const tabs: TabType[] = ["tasks", "notes", "photo"];

  const handleSaveNote = () => {
    onSaveNote(noteContent);
    setIsEditingNote(false);
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

        {/* Tab Indicators */}
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
                  {tasks.map((task) => (
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
                      <div className="flex-1 min-w-0">
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
                      <ValueTag value={task.value} size="sm" />
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

          {/* Notes Tab */}
          {activeTab === "notes" && (
            <div {...tabSwipeHandlers} className="p-4">
              {/* Check-in info */}
              {checkIn && (checkIn.mood || checkIn.note) && (
                <div className="mb-4 pb-4 border-b border-border/30">
                  {checkIn.mood && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{checkIn.mood}</span>
                      <span className="text-xs font-sans text-muted-foreground">Daily check-in</span>
                    </div>
                  )}
                  {checkIn.note && (
                    <div className="bg-primary/5 rounded-lg p-3 mt-2">
                      <p className="text-xs font-sans font-medium text-foreground mb-1">Reflection:</p>
                      <p className="text-sm font-sans text-foreground/80 whitespace-pre-wrap">
                        {checkIn.note}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {isEditingNote ? (
                <div className="space-y-3">
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Write your thoughts for this day..."
                    className="w-full h-48 bg-muted/50 rounded-xl p-3 text-sm font-sans text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setNoteContent(note);
                        setIsEditingNote(false);
                      }}
                      className="flex-1 py-2 rounded-xl bg-muted text-muted-foreground font-sans text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNote}
                      className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground font-sans text-sm font-medium"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {noteContent ? (
                    <div className="bg-muted/50 rounded-xl p-4 min-h-[180px]">
                      <p className="text-sm font-sans text-foreground whitespace-pre-wrap">
                        {noteContent}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Edit3 className="w-8 h-8 text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground font-sans text-sm">
                        No notes yet
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => setIsEditingNote(true)}
                    className="w-full py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    {noteContent ? "Edit Note" : "Add Note"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Photo Tab */}
          {activeTab === "photo" && (
            <div {...tabSwipeHandlers} className="p-4">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                  <Image className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground font-sans text-sm mb-4">
                  Capture a moment from this day
                </p>
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-sans text-sm font-medium">
                  <Camera className="w-4 h-4" />
                  Add Photo
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}