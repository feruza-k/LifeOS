import { format, addDays, isSameDay, startOfDay } from "date-fns";
import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface HorizontalDayStripProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export function HorizontalDayStrip({ selectedDate, onDateSelect }: HorizontalDayStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = startOfDay(new Date());
  
  // Generate 60 days: 30 before and 30 after today
  const days = Array.from({ length: 61 }, (_, i) => addDays(today, i - 30));
  
  useEffect(() => {
    // Scroll to selected date on mount
    if (scrollRef.current) {
      const selectedIndex = days.findIndex(d => isSameDay(d, selectedDate));
      const itemWidth = 56; // width + gap
      const containerWidth = scrollRef.current.offsetWidth;
      const scrollPosition = (selectedIndex * itemWidth) - (containerWidth / 2) + (itemWidth / 2);
      scrollRef.current.scrollLeft = scrollPosition;
    }
  }, []);

  return (
    <div 
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide"
      style={{ scrollBehavior: 'smooth' }}
    >
      {days.map((day) => {
        const isToday = isSameDay(day, today);
        const isSelected = isSameDay(day, selectedDate);
        
        return (
          <button
            key={day.toISOString()}
            onClick={() => onDateSelect(day)}
            className={cn(
              "flex-shrink-0 flex flex-col items-center justify-center w-12 h-14 rounded-xl transition-all duration-200",
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
  );
}
