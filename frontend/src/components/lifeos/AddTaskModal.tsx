import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ValueType } from "./ValueTag";
import { cn } from "@/lib/utils";
import { Repeat, CalendarDays, Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

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

const categories: { value: ValueType; label: string; className: string }[] = [
  { value: "health", label: "Health", className: "bg-tag-health" },
  { value: "growth", label: "Growth", className: "bg-tag-growth" },
  { value: "family", label: "Family", className: "bg-tag-family" },
  { value: "work", label: "Work", className: "bg-tag-work" },
  { value: "creativity", label: "Creative", className: "bg-tag-creativity" },
];

const weekDayLabels = ["S", "M", "T", "W", "T", "F", "S"];

export function AddTaskModal({ isOpen, onClose, onAdd, date }: AddTaskModalProps) {
  const [title, setTitle] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState<ValueType>("growth");
  const [repeatType, setRepeatType] = useState<RepeatType>("none");
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>([]);
  const [periodStart, setPeriodStart] = useState<Date | undefined>();
  const [periodEnd, setPeriodEnd] = useState<Date | undefined>();
  const [customDates, setCustomDates] = useState<Date[]>([]);
  const [showRepeatOptions, setShowRepeatOptions] = useState(false);

  // Calculate end time when start time changes (default to 1 hour later)
  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime);
    if (newStartTime && !endTime) {
      // Calculate 1 hour later
      const [hours, minutes] = newStartTime.split(":").map(Number);
      const endHours = (hours + 1) % 24;
      const endMinutes = minutes;
      setEndTime(`${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`);
    }
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
      date,
      repeat: repeatConfig,
    });

    resetForm();
    onClose();
  };

  const resetForm = () => {
    setTitle("");
    setIsScheduled(false);
    setStartTime("");
    setEndTime("");
    setCategory("growth");
    setRepeatType("none");
    setSelectedWeekDays([]);
    setPeriodStart(undefined);
    setPeriodEnd(undefined);
    setCustomDates([]);
    setShowRepeatOptions(false);
  };

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
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Add New Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-sm font-sans font-medium">
              Task Title
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
            <div className="flex gap-2">
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
          </div>

          {/* Time Fields (only show if Scheduled) */}
          {isScheduled && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="startTime" className="text-sm font-sans font-medium">
                  Start Time
                </Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="mt-1"
                  required={isScheduled}
                />
              </div>
              <div>
                <Label htmlFor="endTime" className="text-sm font-sans font-medium">
                  End Time
                </Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1"
                  required={isScheduled}
                />
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-sans font-medium">Category</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-sans font-medium transition-all",
                    category === cat.value
                      ? `${cat.className} text-white`
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  {cat.label}
                </button>
              ))}
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
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Add Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
