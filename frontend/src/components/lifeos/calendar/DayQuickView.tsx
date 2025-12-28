import { format, isSameDay } from "date-fns";
import { X, ChevronRight } from "lucide-react";
import { Task } from "../TaskItem";
import { ValueTag, ValueType } from "../ValueTag";
import { cn } from "@/lib/utils";

interface DayQuickViewProps {
  date: Date;
  tasks: Task[];
  onClose: () => void;
  onViewFullDay: () => void;
}

export function DayQuickView({ date, tasks, onClose, onViewFullDay }: DayQuickViewProps) {
  const isToday = isSameDay(date, new Date());

  return (
    <div className="fixed inset-x-0 bottom-0 bg-card rounded-t-3xl shadow-card z-50 animate-slide-up pb-safe">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h3 className="font-serif text-lg font-medium text-foreground">
            {isToday ? "Today" : format(date, "EEEE")}
          </h3>
          <p className="text-sm text-muted-foreground font-sans">
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

      <div className="p-4 max-h-64 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="text-center text-muted-foreground font-sans py-8">
            No tasks scheduled
          </p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl bg-muted/50",
                  task.completed && "opacity-60"
                )}
              >
                <div className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  task.value === "social" && "bg-tag-social",
                  task.value === "self" && "bg-tag-self",
                  task.value === "growth" && "bg-tag-growth",
                  task.value === "work" && "bg-tag-work",
                  task.value === "essentials" && "bg-tag-essentials"
                )} />
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
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 pt-0">
        <button
          onClick={onViewFullDay}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-sans font-medium transition-all duration-200 hover:opacity-90"
        >
          View Full Day
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
