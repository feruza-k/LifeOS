import { useRef, useEffect } from "react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Task } from "../TaskItem";
import { ValueType } from "../ValueTag";

interface HorizontalWeekStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  tasks: Task[];
  selectedCategories: ValueType[];
  weeksToShow?: number;
}

export function HorizontalWeekStrip({
  selectedDate,
  onSelectDate,
  tasks,
  selectedCategories,
  weeksToShow = 4,
}: HorizontalWeekStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const startDate = startOfWeek(addDays(today, -7 * Math.floor(weeksToShow / 2)), { weekStartsOn: 1 });

  const days = Array.from({ length: weeksToShow * 7 }, (_, i) => addDays(startDate, i));

  const getTaskCountForDate = (date: Date) => {
    // Simulate task count
    const dayOfMonth = date.getDate();
    return tasks.filter((task) => {
      const matchesCategory = selectedCategories.includes(task.value);
      const taskDay = parseInt(task.id) + (dayOfMonth % 5);
      return matchesCategory && taskDay % 7 === dayOfMonth % 7;
    }).length;
  };

  useEffect(() => {
    // Scroll to today on mount
    if (scrollRef.current) {
      const todayIndex = days.findIndex((d) => isSameDay(d, today));
      const itemWidth = 56; // approximate width of each day item
      const scrollPosition = todayIndex * itemWidth - scrollRef.current.offsetWidth / 2 + itemWidth / 2;
      scrollRef.current.scrollTo({ left: scrollPosition, behavior: "smooth" });
    }
  }, []);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
    >
      {days.map((day) => {
        const isToday = isSameDay(day, today);
        const isSelected = isSameDay(day, selectedDate);
        const taskCount = getTaskCountForDate(day);

        return (
          <button
            key={day.toISOString()}
            onClick={() => onSelectDate(day)}
            className={cn(
              "flex flex-col items-center min-w-[52px] p-2 rounded-2xl transition-all duration-200 snap-center",
              isSelected && "bg-primary",
              isToday && !isSelected && "ring-2 ring-primary",
              !isSelected && !isToday && "bg-card shadow-soft"
            )}
          >
            <span
              className={cn(
                "text-xs font-sans font-medium uppercase",
                isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
              )}
            >
              {format(day, "EEE")}
            </span>
            <span
              className={cn(
                "text-lg font-sans font-bold mt-0.5",
                isSelected ? "text-primary-foreground" : "text-foreground"
              )}
            >
              {format(day, "d")}
            </span>
            {taskCount > 0 && (
              <div
                className={cn(
                  "flex items-center justify-center w-5 h-5 rounded-full text-xs font-sans font-medium mt-1",
                  isSelected
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-primary/15 text-primary"
                )}
              >
                {taskCount}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
