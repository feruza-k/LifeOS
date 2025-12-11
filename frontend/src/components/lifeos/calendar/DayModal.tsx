import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { X, ChevronLeft, ChevronRight, Check, Camera, Image, Edit3 } from "lucide-react";
import { Task } from "../TaskItem";
import { ValueTag } from "../ValueTag";
import { cn } from "@/lib/utils";

interface DayModalProps {
  date: Date;
  tasks: Task[];
  note: string;
  onClose: () => void;
  onToggleTask: (id: string) => void;
  onSaveNote: (content: string) => void;
}

type TabType = "tasks" | "notes" | "photo";

export function DayModal({ 
  date, 
  tasks, 
  note,
  onClose, 
  onToggleTask,
  onSaveNote 
}: DayModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("tasks");
  const [noteContent, setNoteContent] = useState(note);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const isToday = isSameDay(date, new Date());

  const tabs: TabType[] = ["tasks", "notes", "photo"];

  const handleSaveNote = () => {
    onSaveNote(noteContent);
    setIsEditingNote(false);
  };

  const goToTab = (direction: "prev" | "next") => {
    const currentIndex = tabs.indexOf(activeTab);
    if (direction === "prev" && currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    } else if (direction === "next" && currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card rounded-3xl shadow-card w-full max-w-sm animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
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
            <div className="p-4 space-y-2">
              {tasks.length === 0 ? (
                <p className="text-center text-muted-foreground font-sans py-8">
                  No tasks scheduled
                </p>
              ) : (
                tasks.map((task) => (
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
                ))
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === "notes" && (
            <div className="p-4">
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
            <div className="p-4">
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

        {/* Navigation Arrows */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2">
          {activeTab !== "tasks" && (
            <button
              onClick={() => goToTab("prev")}
              className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {activeTab !== "photo" && (
            <button
              onClick={() => goToTab("next")}
              className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}