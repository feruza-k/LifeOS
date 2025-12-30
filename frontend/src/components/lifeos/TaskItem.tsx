import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ValueType } from "./ValueTag";
import { useLifeOSStore } from "@/stores/useLifeOSStore";

export interface Task {
  id: string;
  title: string;
  time?: string;
  endTime?: string;
  completed: boolean;
  value: ValueType;
}

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl bg-card shadow-soft transition-all duration-200",
        task.completed && "opacity-60"
      )}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <button
        onClick={() => onToggle(task.id)}
        className={cn(
          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200",
          task.completed 
            ? "bg-primary border-primary" 
            : "border-muted-foreground/30 hover:border-primary"
        )}
      >
        {task.completed && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
      </button>
      
      <div className="flex-1 min-w-0 relative">
        {/* Subtle category accent bar */}
        {(() => {
          const store = useLifeOSStore();
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
          <div className="flex items-center gap-2">
            <p className={cn(
              "text-sm font-sans font-medium text-foreground truncate",
              task.completed && "line-through text-muted-foreground"
            )}>
              {task.title}
            </p>
          </div>
          {task.time && (
            <p className="text-xs text-muted-foreground font-sans mt-0.5">
              {task.time}{task.endTime && ` - ${task.endTime}`}
              {task.endTime && (() => {
                // Calculate duration
                const [startH, startM] = task.time!.split(":").map(Number);
                const [endH, endM] = task.endTime.split(":").map(Number);
                const startMinutes = startH * 60 + startM;
                const endMinutes = endH * 60 + endM;
                const duration = endMinutes - startMinutes;
                const hours = Math.floor(duration / 60);
                const minutes = duration % 60;
                const durationStr = hours > 0 
                  ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ""}`
                  : `${minutes}m`;
                return ` (${durationStr})`;
              })()}
            </p>
          )}
        </div>
      </div>
      
      {onDelete && (
        <button
          onClick={() => onDelete(task.id)}
          className={cn(
            "p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200",
            showDelete ? "opacity-100" : "opacity-0 md:opacity-0"
          )}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}