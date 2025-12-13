import { format, addDays, isSameDay, startOfWeek, startOfDay, eachDayOfInterval } from "date-fns";
import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface HorizontalDayStripProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export function HorizontalDayStrip({ selectedDate, onDateSelect }: HorizontalDayStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const today = startOfDay(new Date());
  
  // Get Monday of the current week (startOfWeek with weekStartsOn: 1 for Monday)
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  
  // Generate weeks: 4 weeks before current week, current week, 4 weeks after
  // Each week has 7 days (Mon-Sun)
  const weeks: Date[][] = [];
  
  for (let weekOffset = -4; weekOffset <= 4; weekOffset++) {
    const weekStart = addDays(currentWeekStart, weekOffset * 7);
    const weekDays = eachDayOfInterval({
      start: weekStart,
      end: addDays(weekStart, 6) // Monday to Sunday (6 days after Monday)
    });
    weeks.push(weekDays);
  }
  
  // Measure container width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      if (scrollRef.current) {
        setContainerWidth(scrollRef.current.offsetWidth);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);
  
  useEffect(() => {
    // Scroll to the current week (middle week, index 4) on mount
    if (scrollRef.current && containerWidth > 0) {
      const currentWeekIndex = 4; // Middle week (4 weeks before + current week)
      
      // Scroll to show the current week
      scrollRef.current.scrollLeft = currentWeekIndex * containerWidth;
    }
  }, [containerWidth]);

  return (
    <div 
      ref={scrollRef}
      className="flex gap-0 overflow-x-auto py-3 scrollbar-hide snap-x snap-mandatory"
      style={{ 
        scrollBehavior: 'smooth',
        scrollSnapType: 'x mandatory'
      }}
    >
      {weeks.map((weekDays, weekIndex) => (
        <div
          key={weekIndex}
          className="flex gap-2 snap-start flex-shrink-0 px-4"
          style={{ 
            width: containerWidth > 0 ? `${containerWidth}px` : '100%', // Match container width
          }}
        >
          {weekDays.map((day) => {
            const isToday = isSameDay(day, today);
            const isSelected = isSameDay(day, selectedDate);
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => onDateSelect(day)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center h-14 rounded-xl transition-all duration-200",
                  isSelected 
                    ? "bg-primary text-primary-foreground shadow-lg scale-105" 
                    : isToday 
                      ? "bg-primary/20 text-primary" 
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                <span className="text-[10px] font-sans font-medium uppercase">
                  {format(day, "EEE")}
                </span>
                <span className={cn(
                  "text-lg font-sans font-semibold",
                  isSelected ? "text-primary-foreground" : isToday ? "text-primary" : "text-foreground"
                )}>
                  {format(day, "d")}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
