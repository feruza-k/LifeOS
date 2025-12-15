import { useState } from "react";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  className?: string;
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState(() => {
    if (value) {
      return parseInt(value.split(":")[0]) || 12;
    }
    return 12;
  });
  const [selectedMinute, setSelectedMinute] = useState(() => {
    if (value) {
      return parseInt(value.split(":")[1]) || 0;
    }
    return 0;
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const handleTimeChange = (hour: number, minute: number) => {
    const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    onChange(timeString);
  };

  const handleHourSelect = (hour: number) => {
    setSelectedHour(hour);
    handleTimeChange(hour, selectedMinute);
  };

  const handleMinuteSelect = (minute: number) => {
    setSelectedMinute(minute);
    handleTimeChange(selectedHour, minute);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full px-3 py-2 rounded-lg border border-border/50 bg-background text-sm font-sans",
            "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors",
            "flex items-center gap-2",
            className
          )}
        >
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className={cn(
            "flex-1 text-left font-medium",
            value ? "text-foreground" : "text-muted-foreground"
          )}>
            {value || "Select time"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-xl border-border/50 shadow-lg" align="start">
        <div className="flex">
          {/* Hours Column */}
          <div className="w-16 border-r border-border/30">
            <div className="p-1.5 bg-muted/20 border-b border-border/30">
              <span className="text-[10px] font-sans font-medium text-muted-foreground uppercase tracking-wide">Hour</span>
            </div>
            <div className="max-h-[180px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20">
              {hours.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  onClick={() => handleHourSelect(hour)}
                  className={cn(
                    "w-full px-2 py-1.5 text-xs font-sans transition-all",
                    "hover:bg-primary/10",
                    selectedHour === hour
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-foreground/80"
                  )}
                >
                  {hour.toString().padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>

          {/* Minutes Column */}
          <div className="w-16">
            <div className="p-1.5 bg-muted/20 border-b border-border/30">
              <span className="text-[10px] font-sans font-medium text-muted-foreground uppercase tracking-wide">Min</span>
            </div>
            <div className="max-h-[180px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20">
              {minutes.filter(m => m % 5 === 0).map((minute) => (
                <button
                  key={minute}
                  type="button"
                  onClick={() => handleMinuteSelect(minute)}
                  className={cn(
                    "w-full px-2 py-1.5 text-xs font-sans transition-all",
                    "hover:bg-primary/10",
                    selectedMinute === minute
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-foreground/80"
                  )}
                >
                  {minute.toString().padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-2 border-t border-border/30 bg-muted/10">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-sans font-medium hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
