import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ValueType } from "../ValueTag";
import { Task } from "../TaskItem";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface QuickTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: { title?: string; time?: string; endTime?: string; value?: ValueType; completed?: boolean }) => void;
  onDelete?: () => void;
  task: Task | null;
  date: string;
  categories: Array<{ value: ValueType; label: string; color: string }>;
  initialTime?: string; // For quick add from empty block
}

export function QuickTaskModal({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete,
  task,
  date,
  categories,
  initialTime
}: QuickTaskModalProps) {
  const [title, setTitle] = useState(task?.title || "");
  const [startTime, setStartTime] = useState(task?.time || initialTime || "");
  const [endTime, setEndTime] = useState(task?.endTime || "");
  const [category, setCategory] = useState<ValueType>(task?.value || categories[0]?.value || "growth");
  const [completed, setCompleted] = useState(task?.completed || false);

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setStartTime(task.time || "");
      setEndTime(task.endTime || "");
      setCategory(task.value || categories[0]?.value || "growth");
      setCompleted(task.completed || false);
    } else if (initialTime) {
      // For new tasks, pre-fill with initial time
      setTitle("");
      setStartTime(initialTime);
      // Calculate end time (1 hour later)
      const [hours, minutes] = initialTime.split(":").map(Number);
      const totalMinutes = hours * 60 + minutes + 60;
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMins = totalMinutes % 60;
      setEndTime(`${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`);
      setCategory(categories[0]?.value || "growth");
      setCompleted(false);
    }
  }, [task, categories, initialTime]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      time: startTime || undefined,
      endTime: endTime || undefined,
      value: category,
      completed,
    });
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  if (!task && !isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-sans">
            {task ? "Edit Task" : "New Task"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          {/* Title */}
          <div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="text-base"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>

          {/* Date */}
          <div className="text-sm text-muted-foreground font-sans">
            {format(new Date(date), "EEEE, MMMM d")}
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-sans font-medium text-muted-foreground mb-1 block">
                Start Time
              </label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-sans font-medium text-muted-foreground mb-1 block">
                End Time
              </label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-sans font-medium text-muted-foreground mb-2 block">
              Category
            </label>
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-sans font-medium transition-all",
                    category === cat.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Completed Toggle */}
          {task && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCompleted(!completed)}
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                  completed
                    ? "bg-primary border-primary"
                    : "border-muted-foreground/40"
                )}
              >
                {completed && <span className="text-primary-foreground text-xs">✓</span>}
              </button>
              <label className="text-sm font-sans text-foreground">Mark as completed</label>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {task && onDelete && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className={task && onDelete ? "flex-1" : "flex-1"}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="flex-1 bg-primary text-primary-foreground"
              disabled={!title.trim()}
            >
              {task ? "Save" : "Add"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
