import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ValueType } from "./ValueTag";
import { cn } from "@/lib/utils";
import { Repeat, CalendarDays, Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { useLifeOSStore } from "@/stores/useLifeOSStore";

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (task: { title: string; time?: string; endTime?: string; value: ValueType; date: string; repeat?: RepeatConfig }) => void;
  date: string;
}

type RepeatType = "none" | "weekly" | "period" | "custom";

interface RepeatConfig {
  type: RepeatType;
  weekDays?: number[]; // 0-6 for Sun-Sat
  startDate?: string;
  endDate?: string;
  customDates?: string[];
}

const weekDayLabels = ["S", "M", "T", "W", "T", "F", "S"];

export function AddTaskModal({ isOpen, onClose, onAdd, date }: AddTaskModalProps) {
  const store = useLifeOSStore();
  
  // Get categories from store
  const categories = store.categories.map(cat => ({
    value: cat.id as ValueType,
    label: cat.label,
    color: cat.color,
  }));
  
  const [title, setTitle] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [taskDate, setTaskDate] = useState<Date>(parseISO(date));
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState<number>(30); // Default 30 minutes
  const [category, setCategory] = useState<ValueType>(
    categories.length > 0 ? categories[0].value : "growth"
  );
  const [repeatType, setRepeatType] = useState<RepeatType>("none");
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>([]);
  const [periodStart, setPeriodStart] = useState<Date | undefined>();
  const [periodEnd, setPeriodEnd] = useState<Date | undefined>();
  const [customDates, setCustomDates] = useState<Date[]>([]);
  const [showRepeatOptions, setShowRepeatOptions] = useState(false);

  // Calculate end time from start time + duration
  const calculateEndTime = (start: string, dur: number): string => {
    if (!start) return "";
    const [hours, minutes] = start.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + dur;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMins = totalMinutes % 60;
    return `${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`;
  };

  const endTime = calculateEndTime(startTime, duration);

  const durationOptions = [
    { label: "15m", minutes: 15 },
    { label: "30m", minutes: 30 },
    { label: "1h", minutes: 60 },
    { label: "2h", minutes: 120 },
  ];

  const getDateLabel = (date: Date): string => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const repeatConfig: RepeatConfig | undefined = repeatType !== "none" ? {
      type: repeatType,
      weekDays: repeatType === "weekly" ? selectedWeekDays : undefined,
      startDate: repeatType === "period" && periodStart ? format(periodStart, "yyyy-MM-dd") : undefined,
      endDate: repeatType === "period" && periodEnd ? format(periodEnd, "yyyy-MM-dd") : undefined,
      customDates: repeatType === "custom" ? customDates.map(d => format(d, "yyyy-MM-dd")) : undefined,
    } : undefined;

    onAdd({
      title: title.trim(),
      time: isScheduled ? startTime : undefined,
      endTime: isScheduled ? endTime : undefined,
      value: category,
      date: format(taskDate, "yyyy-MM-dd"),
      repeat: repeatConfig,
    });

    resetForm();
    onClose();
  };

  const resetForm = () => {
    setTitle("");
    setIsScheduled(false);
    setTaskDate(parseISO(date));
    setStartTime("");
    setDuration(30);
    setCategory(categories.length > 0 ? categories[0].value : "growth");
    setRepeatType("none");
    setSelectedWeekDays([]);
    setPeriodStart(undefined);
    setPeriodEnd(undefined);
    setCustomDates([]);
    setShowRepeatOptions(false);
  };

  // Reset task date when date prop changes
  useEffect(() => {
    setTaskDate(parseISO(date));
  }, [date]);

  const toggleWeekDay = (day: number) => {
    setSelectedWeekDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleCustomDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setCustomDates(prev => {
      const dateStr = format(date, "yyyy-MM-dd");
      const exists = prev.some(d => format(d, "yyyy-MM-dd") === dateStr);
      if (exists) {
        return prev.filter(d => format(d, "yyyy-MM-dd") !== dateStr);
      }
      return [...prev, date];
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-sans text-xl">New Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-sm font-sans font-medium">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you want to accomplish?"
              className="mt-1"
              autoFocus
            />
          </div>

          {/* Scheduled Toggle */}
          <div>
            <Label className="text-sm font-sans font-medium mb-2 block">
              Schedule
            </Label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setIsScheduled(false)}
                className={cn(
                  "flex-1 p-3 rounded-xl border-2 transition-all",
                  !isScheduled
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                )}
              >
                <span className="text-sm font-sans font-medium">Anytime</span>
              </button>
              <button
                type="button"
                onClick={() => setIsScheduled(true)}
                className={cn(
                  "flex-1 p-3 rounded-xl border-2 transition-all",
                  isScheduled
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                )}
              >
                <span className="text-sm font-sans font-medium">Scheduled</span>
              </button>
            </div>

            {/* Date Selection */}
            <div className="mb-3">
              <Label className="text-xs font-sans font-medium text-muted-foreground mb-1 block">
                Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left font-normal text-sm"
                  >
                    {getDateLabel(taskDate)} ▾
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={taskDate}
                    onSelect={(date) => date && setTaskDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time Fields (only show if Scheduled) */}
            {isScheduled && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="startTime" className="text-sm font-sans font-medium">
                    Start Time
                  </Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-1"
                    required={isScheduled}
                  />
                </div>
                <div>
                  <Label className="text-sm font-sans font-medium mb-2 block">
                    Duration
                  </Label>
                  <div className="flex gap-2 flex-wrap">
                    {durationOptions.map((option) => (
                      <button
                        key={option.minutes}
                        type="button"
                        onClick={() => setDuration(option.minutes)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-sans font-medium transition-all",
                          duration === option.minutes
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-accent"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <Label className="text-sm font-sans font-medium">Category</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {categories.map((cat) => {
                const isSelected = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-sans font-medium transition-all",
                      isSelected
                        ? "text-white"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                    style={isSelected ? { backgroundColor: cat.color } : undefined}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Repeat Options */}
          <div>
            <Label className="text-sm font-sans font-medium">Repeat</Label>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => { setRepeatType("weekly"); setShowRepeatOptions(true); }}
                className={cn(
                  "flex-1 p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1",
                  repeatType === "weekly" 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <Repeat className="w-5 h-5 text-primary" />
                <span className="text-xs font-sans">Weekly</span>
              </button>
              <button
                type="button"
                onClick={() => { setRepeatType("period"); setShowRepeatOptions(true); }}
                className={cn(
                  "flex-1 p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1",
                  repeatType === "period" 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <CalendarDays className="w-5 h-5 text-primary" />
                <span className="text-xs font-sans">Period</span>
              </button>
              <button
                type="button"
                onClick={() => { setRepeatType("custom"); setShowRepeatOptions(true); }}
                className={cn(
                  "flex-1 p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1",
                  repeatType === "custom" 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <CalendarIcon className="w-5 h-5 text-primary" />
                <span className="text-xs font-sans">Custom</span>
              </button>
            </div>

            {/* Weekly Options */}
            {repeatType === "weekly" && showRepeatOptions && (
              <div className="mt-3 p-3 bg-muted/50 rounded-xl">
                <p className="text-xs font-sans text-muted-foreground mb-2">Select days to repeat:</p>
                <div className="flex gap-1 justify-between">
                  {weekDayLabels.map((label, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => toggleWeekDay(index)}
                      className={cn(
                        "w-9 h-9 rounded-full text-xs font-sans font-medium transition-all",
                        selectedWeekDays.includes(index)
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-foreground hover:bg-accent"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Period Options */}
            {repeatType === "period" && showRepeatOptions && (
              <div className="mt-3 p-3 bg-muted/50 rounded-xl space-y-3">
                <p className="text-xs font-sans text-muted-foreground">Select date range:</p>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="flex-1 text-xs">
                        {periodStart ? format(periodStart, "MMM d") : "Start"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={periodStart}
                        onSelect={setPeriodStart}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="self-center text-muted-foreground">→</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="flex-1 text-xs">
                        {periodEnd ? format(periodEnd, "MMM d") : "End"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={periodEnd}
                        onSelect={setPeriodEnd}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Custom Dates */}
            {repeatType === "custom" && showRepeatOptions && (
              <div className="mt-3 p-3 bg-muted/50 rounded-xl">
                <p className="text-xs font-sans text-muted-foreground mb-2">Select specific dates:</p>
                <Calendar
                  mode="multiple"
                  selected={customDates}
                  onSelect={(dates) => setCustomDates(dates || [])}
                  className="rounded-md border-0"
                />
                {customDates.length > 0 && (
                  <p className="text-xs text-primary mt-2">
                    {customDates.length} date{customDates.length > 1 ? "s" : ""} selected
                  </p>
                )}
              </div>
            )}

            {repeatType !== "none" && (
              <button
                type="button"
                onClick={() => { setRepeatType("none"); setShowRepeatOptions(false); }}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear repeat settings
              </button>
            )}
          </div>


          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 rounded-xl">
              Add Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
