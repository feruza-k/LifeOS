import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { cn } from "@/lib/utils";
import { Task } from "../TaskItem";
import { ValueType } from "../ValueTag";
import { Category } from "@/types/lifeos";

interface CalendarTask extends Task {
  date?: string;
}

interface MonthCalendarProps {
  currentMonth: Date;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  tasks: CalendarTask[];
  selectedCategories: ValueType[];
  categories: Category[];
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthCalendar({
  currentMonth,
  selectedDate,
  onSelectDate,
  tasks,
  selectedCategories,
  categories,
}: MonthCalendarProps) {
  const today = new Date();

  // Get category color by id
  const getCategoryColor = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    return category?.color || "#EBEBEB";
  };

  // Convert hex color to rgba with opacity
  const hexToRgba = (hex: string, opacity: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const getTasksForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const allDateTasks = tasks.filter((task) => {
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(task.value);
      return matchesCategory && task.date === dateStr;
    });
    
    // Separate scheduled (with time) and anytime (without time) tasks
    const scheduled = allDateTasks.filter(t => t.time).sort((a, b) => {
      if (!a.time || !b.time) return 0;
      return a.time.localeCompare(b.time);
    });
    const anytime = allDateTasks.filter(t => !t.time);
    
    // Return scheduled first, then anytime
    return [...scheduled, ...anytime];
  };

  const renderDays = () => {
    const days = [];
    let day = calendarStart;

    while (day <= calendarEnd) {
      const currentDay = day;
      const isCurrentMonth = isSameMonth(day, monthStart);
      const isToday = isSameDay(day, today);
      const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
      const dayTasks = getTasksForDate(day);
      // Show scheduled tasks first (up to 3), then show if there are more
      const scheduledTasks = dayTasks.filter(t => t.time);
      const anytimeTasks = dayTasks.filter(t => !t.time);
      const displayScheduled = scheduledTasks.slice(0, 3);
      const displayAnytime = scheduledTasks.length < 3 ? anytimeTasks.slice(0, 3 - scheduledTasks.length) : [];
      const displayTasks = [...displayScheduled, ...displayAnytime];
      const remainingCount = dayTasks.length - displayTasks.length;
      const completedCount = dayTasks.filter(t => t.completed).length;

      days.push(
        <button
          key={day.toISOString()}
          onClick={() => onSelectDate(currentDay)}
          className={cn(
            "relative flex flex-col items-start p-2 min-h-[100px] rounded-lg transition-all duration-200 text-left border-l-4",
            !isCurrentMonth && "opacity-30",
            isSelected && "bg-primary border-l-primary",
            !isSelected && isCurrentMonth && isToday && "border-l-primary/40 bg-background",
            !isSelected && isCurrentMonth && !isToday && "border-l-transparent hover:bg-muted/50",
          )}
        >
          <span
            className={cn(
              "font-sans font-semibold mb-1",
              isToday && !isSelected && "text-primary text-base",
              !isToday && "text-xs",
              isSelected ? "text-primary-foreground text-xs" : "text-foreground"
            )}
          >
            {format(day, "d")}
          </span>
          
          {/* Task titles */}
          <div className="w-full space-y-1 overflow-hidden flex-1">
            {displayTasks.map((task, i) => {
              const categoryColor = getCategoryColor(task.value);
              return (
                <div
                  key={task.id + i}
                  className={cn(
                    "text-xs leading-snug truncate rounded px-1.5 py-1 font-sans",
                    task.completed && "line-through opacity-50",
                    isSelected && "text-primary-foreground"
                  )}
                  style={{
                    backgroundColor: isSelected 
                      ? "rgba(255, 255, 255, 0.2)" 
                      : hexToRgba(categoryColor, 0.4),
                    color: isSelected ? undefined : "inherit"
                  }}
                >
                  {task.title}
                </div>
              );
            })}
            {remainingCount > 0 && (
              <span className={cn(
                "text-[10px] font-sans font-medium",
                isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
              )}>
                +{remainingCount} more
              </span>
            )}
          </div>
        </button>
      );

      day = addDays(day, 1);
    }

    return days;
  };

  return (
    <div className="px-3 pb-3 animate-slide-up">
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-sans font-medium text-muted-foreground py-1.5"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">{renderDays()}</div>
      
      <p className="text-center text-xs text-muted-foreground/60 font-sans mt-3">
        Swipe left/right to change month
      </p>
    </div>
  );
}