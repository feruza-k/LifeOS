import { format, startOfWeek, addDays, isToday } from "date-fns";
import { Task } from "@/components/lifeos/TaskItem";
import { ValueType, ValueTag } from "@/components/lifeos/ValueTag";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface WeekVerticalViewProps {
  selectedDate: Date;
  tasks: Task[];
  selectedCategories: ValueType[];
  onToggleTask: (id: string) => void;
}

export function WeekVerticalView({
  selectedDate,
  tasks,
  selectedCategories,
  onToggleTask,
}: WeekVerticalViewProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday start

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      date,
      dayName: format(date, "EEEE").toUpperCase(),
      dateStr: format(date, "MMM d"),
      isToday: isToday(date),
    };
  });

  // Get tasks for a specific date
  const getTasksForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    // Filter by selected categories
    return tasks.filter(
      (task) =>
        task.value && selectedCategories.includes(task.value as ValueType)
    );
  };

  // Simulated tasks for demo - in real app this would come from store
  const getSimulatedTasks = (date: Date) => {
    const dayOfWeek = date.getDay();
    const dateNum = date.getDate();
    
    const allTasks: Task[] = [
      { id: `${dateNum}-1`, title: "Morning meditation", time: "07:00", completed: false, value: "health" as ValueType },
      { id: `${dateNum}-2`, title: "Team standup", time: "09:30", completed: true, value: "work" as ValueType },
      { id: `${dateNum}-3`, title: "Lunch with family", time: "12:30", completed: false, value: "family" as ValueType },
      { id: `${dateNum}-4`, title: "Deep work session", time: "14:00", completed: false, value: "growth" as ValueType },
      { id: `${dateNum}-5`, title: "Evening run", time: "18:00", completed: false, value: "health" as ValueType },
      { id: `${dateNum}-6`, title: "Creative writing", time: "20:00", completed: false, value: "creativity" as ValueType },
    ];

    // Return different subset based on day
    const tasksPerDay = [
      [0, 1, 4], // Sunday
      [0, 1, 2, 3, 4], // Monday
      [1, 3, 5], // Tuesday
      [0, 2, 3, 4], // Wednesday
      [1, 2, 4, 5], // Thursday
      [0, 1, 3], // Friday
      [2, 4, 5], // Saturday
    ];

    return tasksPerDay[dayOfWeek]
      .map((i) => allTasks[i])
      .filter((task) => task.value && selectedCategories.includes(task.value as ValueType));
  };

  return (
    <div className="px-4 py-4 space-y-1 animate-slide-up overflow-y-auto max-h-[calc(100vh-280px)]">
      {weekDays.map((day, index) => {
        const dayTasks = getSimulatedTasks(day.date);
        
        return (
          <div key={index} className="pb-4">
            {/* Day Header */}
            <div className={cn(
              "flex items-center gap-3 py-3 px-1 border-b border-border/50",
              day.isToday && "border-primary/50"
            )}>
              <div className={cn(
                "text-sm font-sans font-bold tracking-wider",
                day.isToday ? "text-primary" : "text-foreground"
              )}>
                {day.dayName}
              </div>
              <div className={cn(
                "text-sm font-sans",
                day.isToday ? "text-primary" : "text-muted-foreground"
              )}>
                {day.dateStr}
              </div>
              {day.isToday && (
                <span className="text-xs font-sans bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  Today
                </span>
              )}
            </div>

            {/* Tasks for this day */}
            <div className="mt-3 space-y-2">
              {dayTasks.length > 0 ? (
                dayTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 transition-all",
                      task.completed && "opacity-60"
                    )}
                  >
                    <button
                      onClick={() => onToggleTask(task.id)}
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                        task.completed
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/40 hover:border-primary"
                      )}
                    >
                      {task.completed && (
                        <Check className="w-3 h-3 text-primary-foreground" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-sans text-sm",
                        task.completed ? "line-through text-muted-foreground" : "text-foreground"
                      )}>
                        {task.title}
                      </p>
                    </div>
                    {task.time && (
                      <span className="text-xs font-sans text-muted-foreground shrink-0">
                        {task.time}
                      </span>
                    )}
                    {task.value && <ValueTag value={task.value} size="sm" />}
                  </div>
                ))
              ) : (
                <div className="py-3 text-center text-muted-foreground/50 text-sm font-sans">
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}