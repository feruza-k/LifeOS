import { useMemo, useState } from "react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

interface WeekSelectorProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export function WeekSelector({ selectedDate, onDateSelect }: WeekSelectorProps) {
  const today = new Date();
  
  const weekDays = useMemo(() => {
    const start = startOfWeek(today, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, []);

  return (
    <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.1s" }}>
      <div className="flex justify-between gap-1">
        {weekDays.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={cn(
                "flex flex-col items-center py-2 px-3 rounded-xl transition-all duration-200",
                isSelected 
                  ? "bg-primary text-primary-foreground shadow-soft" 
                  : "hover:bg-accent"
              )}
            >
              <span className={cn(
                "text-xs font-sans font-medium uppercase tracking-wide",
                isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
              )}>
                {format(day, "EEE")}
              </span>
              <span className={cn(
                "text-lg font-sans font-semibold mt-0.5",
                isSelected ? "text-primary-foreground" : "text-foreground"
              )}>
                {format(day, "d")}
              </span>
              {isToday && !isSelected && (
                <div className="w-1 h-1 rounded-full bg-primary mt-1" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
