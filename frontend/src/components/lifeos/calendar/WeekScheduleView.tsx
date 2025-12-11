import { useState } from "react";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { Task } from "@/components/lifeos/TaskItem";
import { ValueType } from "@/components/lifeos/ValueTag";
import { cn } from "@/lib/utils";
import { useSwipeable } from "react-swipeable";

interface WeekScheduleViewProps {
  selectedDate: Date;
  tasks: Task[];
  selectedCategories: ValueType[];
  onToggleTask: (id: string) => void;
  onWeekChange: (date: Date) => void;
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM to 9 PM
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const categoryColors: Record<ValueType, string> = {
  health: "bg-tag-health",
  growth: "bg-primary",
  family: "bg-tag-family",
  work: "bg-tag-work",
  creativity: "bg-tag-creativity",
};

export function WeekScheduleView({
  selectedDate,
  tasks,
  selectedCategories,
  onToggleTask,
  onWeekChange,
}: WeekScheduleViewProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      date,
      dayName: DAYS[i],
      dayNum: format(date, "d"),
      fullDate: format(date, "yyyy-MM-dd"),
      isToday: format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"),
    };
  });

  // Get task position and height based on time and duration
  const getTaskStyle = (time: string, duration: number = 60) => {
    const [hours, minutes] = time.split(":").map(Number);
    const startHour = hours - 6; // Offset from 6 AM
    const topPercent = ((startHour * 60 + minutes) / (16 * 60)) * 100;
    const heightPercent = (duration / (16 * 60)) * 100;
    return {
      top: `${topPercent}%`,
      height: `${Math.max(heightPercent, 3)}%`,
    };
  };

  // Get tasks for a specific date
  const getTasksForDate = (dateStr: string) => {
    const allTasks = tasks.filter(
      (task) =>
        task.date === dateStr &&
        task.value &&
        selectedCategories.includes(task.value as ValueType)
    );
    
    // Separate scheduled and anytime tasks
    const scheduled = allTasks.filter(t => t.time).sort((a, b) => {
      if (!a.time || !b.time) return 0;
      return a.time.localeCompare(b.time);
    });
    const anytime = allTasks.filter(t => !t.time);
    
    return { scheduled, anytime };
  };

  // Legacy function - keeping for reference but not using
  const getSimulatedTasks = (dateStr: string, dayIndex: number) => {
    const baseDate = new Date(dateStr);
    const dateNum = baseDate.getDate();
    
    const allTasks = [
      { id: `${dateStr}-1`, title: "Meditation", time: "07:00", duration: 30, completed: false, value: "health" as ValueType },
      { id: `${dateStr}-2`, title: "Standup", time: "09:30", duration: 30, completed: dayIndex < 3, value: "work" as ValueType },
      { id: `${dateStr}-3`, title: "Deep Work", time: "10:00", duration: 120, completed: false, value: "work" as ValueType },
      { id: `${dateStr}-4`, title: "Lunch", time: "12:30", duration: 60, completed: false, value: "family" as ValueType },
      { id: `${dateStr}-5`, title: "Meeting", time: "14:00", duration: 60, completed: false, value: "work" as ValueType },
      { id: `${dateStr}-6`, title: "Workout", time: "18:00", duration: 60, completed: false, value: "health" as ValueType },
      { id: `${dateStr}-7`, title: "Writing", time: "20:00", duration: 60, completed: false, value: "creativity" as ValueType },
    ];

    const tasksPerDay = [
      [0, 1, 2, 4, 5], // Monday
      [0, 2, 3, 6], // Tuesday
      [1, 2, 4, 5], // Wednesday
      [0, 3, 4, 5, 6], // Thursday
      [1, 2, 3], // Friday
      [0, 5, 6], // Saturday
      [3, 5], // Sunday
    ];

    return tasksPerDay[dayIndex]
      .map((i) => allTasks[i])
      .filter((task) => task.value && selectedCategories.includes(task.value));
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => onWeekChange(addWeeks(selectedDate, 1)),
    onSwipedRight: () => onWeekChange(subWeeks(selectedDate, 1)),
    trackMouse: false,
    trackTouch: true,
  });

  return (
    <div {...handlers} className="px-2 animate-slide-up">
      {/* Week Header */}
      <div className="grid grid-cols-8 gap-0.5 mb-1">
        <div className="text-[10px] text-muted-foreground font-sans text-center py-1"></div>
        {weekDays.map((day, i) => (
          <div
            key={i}
            className={cn(
              "text-center py-1",
              day.isToday && "bg-primary/10 rounded-lg"
            )}
          >
            <div className={cn(
              "text-[10px] font-sans font-medium",
              day.isToday ? "text-primary" : "text-muted-foreground"
            )}>
              {day.dayName}
            </div>
            <div className={cn(
              "text-sm font-sans font-bold",
              day.isToday ? "text-primary" : "text-foreground"
            )}>
              {day.dayNum}
            </div>
          </div>
        ))}
      </div>

      {/* Schedule Grid */}
      <div className="relative bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="grid grid-cols-8 gap-0.5">
          {/* Time Column */}
          <div className="border-r border-border/30">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-10 flex items-start justify-end pr-1 pt-0.5"
              >
                <span className="text-[9px] text-muted-foreground font-sans">
                  {hour}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {weekDays.map((day, dayIndex) => {
            const { scheduled, anytime } = getTasksForDate(day.fullDate);
            
            // Calculate duration from time and endTime
            const getDuration = (task: Task) => {
              if (!task.time || !task.endTime) return 60;
              const [startH, startM] = task.time.split(":").map(Number);
              const [endH, endM] = task.endTime.split(":").map(Number);
              const startMinutes = startH * 60 + startM;
              const endMinutes = endH * 60 + endM;
              return endMinutes - startMinutes;
            };
            
            return (
              <div
                key={day.fullDate}
                className={cn(
                  "relative border-r border-border/20 last:border-r-0",
                  day.isToday && "bg-primary/5"
                )}
              >
                {/* Hour lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="h-10 border-b border-border/10"
                  />
                ))}

                {/* Scheduled Tasks */}
                <div className="absolute inset-0">
                  {scheduled.map((task) => {
                    const duration = getDuration(task);
                    const style = getTaskStyle(task.time!, duration);
                    return (
                      <button
                        key={task.id}
                        onClick={() => onToggleTask(task.id)}
                        style={{ top: style.top, height: style.height }}
                        className={cn(
                          "absolute left-0.5 right-0.5 rounded px-0.5 py-0.5 overflow-hidden transition-all",
                          categoryColors[task.value as ValueType],
                          task.completed ? "opacity-40" : "opacity-90",
                          "hover:opacity-100"
                        )}
                      >
                        <p className={cn(
                          "text-[8px] font-sans font-medium text-white truncate leading-tight",
                          task.completed && "line-through"
                        )}>
                          {task.title}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-center text-[10px] text-muted-foreground/60 font-sans mt-2">
        Swipe left/right to change week
      </p>

      {/* Anytime Tasks Section */}
      {weekDays.some(day => {
        const { anytime } = getTasksForDate(day.fullDate);
        return anytime.length > 0;
      }) && (
        <div className="mt-4 space-y-3">
          <h3 className="text-xs font-sans font-semibold text-muted-foreground uppercase tracking-wide px-2">
            Anytime
          </h3>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const { anytime } = getTasksForDate(day.fullDate);
              return (
                <div key={day.fullDate} className="space-y-1">
                  {anytime.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => onToggleTask(task.id)}
                      className={cn(
                        "w-full p-2 rounded-lg text-left transition-all",
                        categoryColors[task.value as ValueType],
                        task.completed ? "opacity-40" : "opacity-90",
                        "hover:opacity-100"
                      )}
                    >
                      <p className={cn(
                        "text-[9px] font-sans font-medium text-white truncate",
                        task.completed && "line-through"
                      )}>
                        {task.title}
                      </p>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}