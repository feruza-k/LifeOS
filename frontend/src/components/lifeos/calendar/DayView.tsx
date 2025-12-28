import { format, isSameDay } from "date-fns";
import { Task } from "../TaskItem";
import { ValueTag, ValueType } from "../ValueTag";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle2, Circle } from "lucide-react";

interface DayViewProps {
  date: Date;
  tasks: Task[];
  selectedCategories: ValueType[];
  onToggleTask: (id: string) => void;
}

export function DayView({ date, tasks, selectedCategories, onToggleTask }: DayViewProps) {
  const isToday = isSameDay(date, new Date());

  // Simulate getting tasks for a specific date
  const dayOfMonth = date.getDate();
  const filteredTasks = tasks.filter((task) => {
    const matchesCategory = selectedCategories.includes(task.value);
    const taskDay = parseInt(task.id) + (dayOfMonth % 5);
    return matchesCategory && taskDay % 7 === dayOfMonth % 7;
  });

  // Group by time periods
  const morningTasks = filteredTasks.filter((t) => {
    const hour = parseInt(t.time?.split(":")[0] || "12");
    return hour < 12;
  });

  const afternoonTasks = filteredTasks.filter((t) => {
    const hour = parseInt(t.time?.split(":")[0] || "12");
    return hour >= 12 && hour < 17;
  });

  const eveningTasks = filteredTasks.filter((t) => {
    const hour = parseInt(t.time?.split(":")[0] || "12");
    return hour >= 17;
  });

  const timeGroups = [
    { label: "Morning", tasks: morningTasks, icon: "🌅" },
    { label: "Afternoon", tasks: afternoonTasks, icon: "☀️" },
    { label: "Evening", tasks: eveningTasks, icon: "🌙" },
  ].filter((g) => g.tasks.length > 0);

  const completedCount = filteredTasks.filter((t) => t.completed).length;
  const totalCount = filteredTasks.length;

  return (
    <div className="px-4 py-4 animate-slide-up">
      {/* Day Header */}
      <div className="bg-card rounded-2xl shadow-soft p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-medium text-foreground">
              {isToday ? "Today" : format(date, "EEEE")}
            </h2>
            <p className="text-sm text-muted-foreground font-sans">
              {format(date, "MMMM d, yyyy")}
            </p>
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-sans font-medium text-primary">
                {completedCount}/{totalCount}
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Tasks by Time */}
      {timeGroups.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground font-sans">No tasks scheduled</p>
          <p className="text-sm text-muted-foreground/70 font-sans mt-1">
            Tap + to add a new task
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {timeGroups.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="text-lg">{group.icon}</span>
                <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                  {group.label}
                </h3>
              </div>
              <div className="space-y-2">
                {group.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl bg-card shadow-soft transition-all duration-200",
                      task.completed && "opacity-60"
                    )}
                  >
                    <button
                      onClick={() => onToggleTask(task.id)}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0",
                        task.completed
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/30 hover:border-primary"
                      )}
                    >
                      {task.completed && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />
                      )}
                    </button>

                    <div
                      className={cn(
                        "w-1 h-8 rounded-full flex-shrink-0",
                        task.value === "social" && "bg-tag-social",
                        task.value === "self" && "bg-tag-self",
                        task.value === "growth" && "bg-tag-growth",
                        task.value === "work" && "bg-tag-work",
                        task.value === "essentials" && "bg-tag-essentials"
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "font-sans font-medium text-foreground",
                          task.completed && "line-through text-muted-foreground"
                        )}
                      >
                        {task.title}
                      </p>
                      {task.time && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground font-sans">
                            {task.time}
                          </p>
                        </div>
                      )}
                    </div>

                    <ValueTag value={task.value} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
