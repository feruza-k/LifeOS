import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ValueType } from "./ValueTag";
import { Task } from "./TaskItem";
import { cn } from "@/lib/utils";
import { X, Calendar, Clock, Tag, Repeat, CalendarDays, Calendar as CalendarIcon, AlertTriangle, Sparkles } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { useLifeOSStore } from "@/stores/useLifeOSStore";
import { TimePicker } from "./TimePicker";
import { toast } from "sonner";
import { i18n } from "@/utils/i18n";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (task: { title: string; time?: string; endTime?: string; value: ValueType; date: string; repeat?: RepeatConfig }) => Promise<any>;
  date: string;
  task?: Task | null; // For editing
  initialTime?: string; // For quick add from week view
  onUpdate?: (id: string, updates: Partial<Task>) => void; // For editing
  onDelete?: (id: string) => void; // For editing
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

export function AddTaskModal({ isOpen, onClose, onAdd, date, task, initialTime, onUpdate, onDelete }: AddTaskModalProps) {
  const store = useLifeOSStore();
  
  // Get categories from store - make it reactive
  const categories = useMemo(() => {
    return store.categories.map(cat => ({
      value: cat.id as ValueType,
      label: cat.label,
      color: cat.color,
    }));
  }, [store.categories]);
  
  const [title, setTitle] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [taskDate, setTaskDate] = useState<Date>(parseISO(date));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<{
    message: string;
    conflictingTasks: Array<{ id: string; title: string; time: string; endTime?: string }>;
    suggestedAlternative: { time: string; datetime?: string } | null;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{
    title: string;
    time?: string;
    category?: string;
    priority?: string;
  }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  
  // Load task suggestions when modal opens
  useEffect(() => {
    if (isOpen && !task) {
      loadSuggestions();
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [isOpen, task]);
  
  const loadSuggestions = async () => {
    try {
      setIsLoadingSuggestions(true);
      const response = await api.getTaskSuggestions(6);
      if (response?.suggestions) {
        setSuggestions(response.suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("Failed to load task suggestions:", error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };
  
  const handleSelectSuggestion = (suggestion: typeof suggestions[0]) => {
    setTitle(suggestion.title);
    if (suggestion.time) {
      setStartTime(suggestion.time);
      setIsScheduled(true);
      // Calculate end time (default 1 hour)
      const [hours, minutes] = suggestion.time.split(":").map(Number);
      const totalMinutes = hours * 60 + minutes + 60;
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMins = totalMinutes % 60;
      setEndTime(`${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`);
    }
    if (suggestion.category) {
      // Find category by ID
      const categoryMatch = categories.find(c => c.value === suggestion.category);
      if (categoryMatch) {
        setCategory(categoryMatch.value);
      }
    }
    setShowSuggestions(false);
  };
  
  // Load task data when editing or when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setTitle("");
      setIsScheduled(false);
      setStartTime("");
      setEndTime("");
      setDuration(30);
      setCategory(categories.length > 0 ? categories[0].value : "growth");
      setRepeatType("none");
      setSelectedWeekDays([]);
      setPeriodStart(undefined);
      setPeriodEnd(undefined);
      setCustomDates([]);
      setShowRepeatOptions(false);
      setShowDatePicker(false);
      setShowTimePicker(false);
      setShowCategoryPicker(false);
      setShowRepeatPicker(false);
      setTaskDate(parseISO(date));
      return;
    }
    
    if (task) {
      // Editing existing task
      setTitle(task.title);
      setCategory(task.value);
      if (task.time) {
        setStartTime(task.time);
        setIsScheduled(true);
      } else {
        setIsScheduled(false);
      }
      if (task.endTime) {
        setEndTime(task.endTime);
      }
      if (task.date) {
        setTaskDate(parseISO(task.date));
      } else {
        setTaskDate(parseISO(date));
      }
      // Load repeat config if exists
      if ((task as any).repeat) {
        const repeat = (task as any).repeat;
        setRepeatType(repeat.type || "none");
        setSelectedWeekDays(repeat.weekDays || []);
        setPeriodStart(repeat.startDate ? parseISO(repeat.startDate) : undefined);
        setPeriodEnd(repeat.endDate ? parseISO(repeat.endDate) : undefined);
        setCustomDates(repeat.customDates ? repeat.customDates.map((d: string) => parseISO(d)) : []);
        setShowRepeatOptions(repeat.type !== "none");
      }
    } else if (initialTime) {
      // Quick add from week view - default to scheduled
      setTitle("");
      setStartTime(initialTime);
      setIsScheduled(true);
      const calculatedEnd = calculateEndTime(initialTime, 30);
      setEndTime(calculatedEnd);
      setTaskDate(parseISO(date));
    } else {
      // New task - reset to defaults
      setTitle("");
      setIsScheduled(false);
      setStartTime("");
      setEndTime("");
      setDuration(30);
      setCategory(categories.length > 0 ? categories[0].value : "growth");
      setTaskDate(parseISO(date));
    }
  }, [isOpen, task, initialTime, date, categories]);

  // Calculate end time from start time + duration
  const calculateEndTime = (start: string, dur: number): string => {
    if (!start) return "";
    const [hours, minutes] = start.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + dur;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMins = totalMinutes % 60;
    return `${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`;
  };

  const durationOptions = [
    { label: "15m", minutes: 15 },
    { label: "30m", minutes: 30 },
    { label: "1h", minutes: 60 },
    { label: "2h", minutes: 120 },
    { label: "3h", minutes: 180 },
  ];

  const getDateLabel = (date: Date): string => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (!title.trim()) return;
    if (isSubmitting) return;

    const repeatConfig: RepeatConfig | undefined = repeatType !== "none" ? {
      type: repeatType,
      weekDays: repeatType === "weekly" ? selectedWeekDays : undefined,
      startDate: repeatType === "period" && periodStart ? format(periodStart, "yyyy-MM-dd") : undefined,
      endDate: repeatType === "period" && periodEnd ? format(periodEnd, "yyyy-MM-dd") : undefined,
      customDates: repeatType === "custom" ? customDates.map(d => format(d, "yyyy-MM-dd")) : undefined,
    } : undefined;

    if (task && onUpdate) {
      // Editing existing task
      onUpdate(task.id, {
        title: title.trim(),
        time: isScheduled ? startTime : undefined,
        endTime: isScheduled ? (endTime || calculateEndTime(startTime, duration)) : undefined,
        value: category,
        ...(repeatConfig && { repeat: repeatConfig }),
      });
      resetForm();
      onClose();
    } else {
      // Adding new task - check for conflicts
      setIsSubmitting(true);
      try {
        const result = await onAdd({
          title: title.trim(),
          time: isScheduled ? startTime : undefined,
          endTime: isScheduled ? (endTime || calculateEndTime(startTime, duration)) : undefined,
          value: category,
          date: format(taskDate, "yyyy-MM-dd"),
          repeat: repeatConfig,
        });
        
        // Check if result is a conflict response
        if (result && typeof result === 'object' && 'conflict' in result && result.conflict === true) {
          // Show conflict message inline - keep modal open with all entered data
          setConflictInfo({
            message: result.message || "This time conflicts with an existing task.",
            conflictingTasks: result.conflicting_tasks || [],
            suggestedAlternative: result.suggested_alternative || null,
          });
          setIsSubmitting(false);
          // Don't close modal or reset form - let user adjust time
          // Return the conflict result so caller knows not to close modal
          return result;
        }
        
        // Success - clear any conflict info, reset and close
        setConflictInfo(null);
        resetForm();
        onClose();
        return result;
      } catch (error: any) {
        toast.error(error?.message || "Failed to add task. Please try again.");
        setIsSubmitting(false);
      }
    }
  };

  const handleUseSuggestedTime = () => {
    if (!conflictInfo || !conflictInfo.suggestedAlternative) return;
    
    // Update the form with suggested time
    const suggestedTime = conflictInfo.suggestedAlternative.time;
    setStartTime(suggestedTime);
    
    // Calculate end time based on duration
    const calculatedEnd = calculateEndTime(suggestedTime, duration);
    setEndTime(calculatedEnd);
    
    // Clear conflict info
    setConflictInfo(null);
  };

  const resetForm = () => {
    setTitle("");
    setIsScheduled(false);
    setTaskDate(parseISO(date));
    setStartTime("");
    setEndTime("");
    setDuration(30);
    setCategory(categories.length > 0 ? categories[0].value : "growth");
    setRepeatType("none");
    setSelectedWeekDays([]);
    setPeriodStart(undefined);
    setPeriodEnd(undefined);
    setCustomDates([]);
    setShowRepeatOptions(false);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowCategoryPicker(false);
    setShowRepeatPicker(false);
  };

  // Reset task date when date prop changes
  useEffect(() => {
    setTaskDate(parseISO(date));
  }, [date]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card rounded-3xl shadow-card w-full max-w-sm animate-scale-in overflow-hidden z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <h3 className="font-sans text-lg font-semibold text-foreground">{task ? "Edit Task" : "New Task"}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-[280px] max-h-[320px] overflow-y-auto">
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="p-4 space-y-4">
          {/* Title Input - Dominant */}
          <div className="relative">
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setShowSuggestions(e.target.value.length === 0 && suggestions.length > 0);
              }}
              onFocus={() => {
                if (suggestions.length > 0 && !title.trim()) {
                  setShowSuggestions(true);
                }
              }}
              placeholder="What do you want to accomplish?"
              className="text-lg font-sans font-medium py-4 w-full rounded-md border border-input bg-background px-3 text-base text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (title.trim()) handleSubmit(e);
                } else if (e.key === "Escape") {
                  setShowSuggestions(false);
                }
              }}
            />
            
            {/* Task Suggestions */}
            {showSuggestions && suggestions.length > 0 && !title.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                <div className="p-2">
                  <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-xs font-sans font-medium text-muted-foreground">Suggestions</span>
                  </div>
                  <div className="space-y-1">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors flex items-center justify-between group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-sans font-medium text-foreground truncate">
                            {suggestion.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {suggestion.category && (() => {
                              const cat = categories.find(c => c.value === suggestion.category);
                              return cat ? (
                                <span 
                                  className="text-xs font-sans px-1.5 py-0.5 rounded"
                                  style={{ 
                                    backgroundColor: `${cat.color}20`,
                                    color: cat.color
                                  }}
                                >
                                  {cat.label}
                                </span>
                              ) : null;
                            })()}
                            {suggestion.priority === "goal" && (
                              <span className="text-xs text-primary font-sans">Goal</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Action Row - Icon Buttons */}
          <div className="flex items-center gap-2">
            {/* Date Button */}
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-all relative",
                    !isToday(taskDate) && !isTomorrow(taskDate)
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                  )}
                  title={getDateLabel(taskDate)}
                >
                  <Calendar className="w-4 h-4" />
                  {!isToday(taskDate) && !isTomorrow(taskDate) && (
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border border-card" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={taskDate}
                  onSelect={(date) => {
                    if (date) {
                      setTaskDate(date);
                      setShowDatePicker(false);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Time Button (only if scheduled) */}
            {isScheduled && (
              <Popover open={showTimePicker} onOpenChange={setShowTimePicker}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center transition-all border",
                      conflictInfo 
                        ? "border-destructive bg-destructive/5" 
                        : startTime
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border-border"
                    )}
                  >
                    <Clock className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="start">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs font-sans font-medium text-muted-foreground mb-1 block">
                          Start Time
                        </label>
                        <TimePicker
                          value={startTime}
                          onChange={(time) => {
                            setStartTime(time);
                            setConflictInfo(null); // Clear conflict when time changes
                            if (time && !endTime) {
                              setEndTime(calculateEndTime(time, duration));
                            }
                          }}
                          className="w-28"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-sans font-medium text-muted-foreground mb-1 block">
                          End Time
                        </label>
                        <TimePicker
                          value={endTime}
                          onChange={(time) => {
                            setEndTime(time);
                            setConflictInfo(null); // Clear conflict when time changes
                          }}
                          className="w-28"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-sans font-medium text-muted-foreground mb-2 block">
                        Duration
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {durationOptions.map((option) => (
                          <button
                            key={option.minutes}
                            type="button"
                            onClick={() => {
                              setDuration(option.minutes);
                              if (startTime) {
                                setEndTime(calculateEndTime(startTime, option.minutes));
                              }
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-all",
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
                </PopoverContent>
              </Popover>
            )}

            {/* Category Button */}
            <Popover open={showCategoryPicker} onOpenChange={setShowCategoryPicker}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-all relative",
                    "hover:opacity-80"
                  )}
                  style={{
                    backgroundColor: (() => {
                      const selectedCategory = categories.find(c => c.value === category);
                      return selectedCategory?.color ? `${selectedCategory.color}20` : undefined;
                    })(),
                  }}
                >
                  {(() => {
                    const selectedCategory = categories.find(c => c.value === category);
                    const categoryColor = selectedCategory?.color;
                    return (
                      <Tag 
                        className="w-5 h-5" 
                        style={{ 
                          color: categoryColor || "currentColor",
                          fill: categoryColor || "currentColor",
                          opacity: 1
                        }} 
                      />
                    );
                  })()}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <div className="flex flex-col gap-1.5 min-w-[120px]">
                  {categories.map((cat) => {
                    const isSelected = category === cat.value;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => {
                          setCategory(cat.value);
                          setShowCategoryPicker(false);
                        }}
                        className={cn(
                          "px-3 py-2 rounded-lg text-sm font-sans font-medium transition-all text-left flex items-center gap-2",
                          isSelected
                            ? "text-white"
                            : "bg-muted text-muted-foreground hover:bg-accent"
                        )}
                        style={isSelected ? { backgroundColor: cat.color } : undefined}
                      >
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {/* Schedule Toggle - Minimal */}
            <div className="flex-1 flex justify-end">
              <div className="flex gap-1 bg-muted/50 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setIsScheduled(false)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-base font-sans font-medium transition-all",
                    !isScheduled
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Anytime
                </button>
                <button
                  type="button"
                  onClick={() => setIsScheduled(true)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-base font-sans font-medium transition-all",
                    isScheduled
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Scheduled
                </button>
              </div>
            </div>
          </div>

          {/* Time Display (if scheduled and time set) */}
          {isScheduled && startTime && endTime && (
            <div className="text-xs text-muted-foreground font-sans px-1">
              {startTime} - {endTime}
            </div>
          )}

          {/* Make Recurring Options - Always Shown */}
          <div className="p-3 bg-muted/30 rounded-xl space-y-3 border border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-base font-sans font-medium text-foreground">Make Recurring</span>
              {repeatType !== "none" && (
                <button
                  type="button"
                  onClick={() => {
                    setRepeatType("none");
                    setShowRepeatOptions(false);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setRepeatType("weekly"); setShowRepeatOptions(true); }}
                  className={cn(
                    "flex-1 p-2 rounded-lg border transition-all flex flex-col items-center gap-1",
                    repeatType === "weekly" 
                      ? "border-primary bg-primary/10" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Repeat className="w-4 h-4 text-primary" />
                  <span className="text-sm font-sans">Weekly</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setRepeatType("period"); setShowRepeatOptions(true); }}
                  className={cn(
                    "flex-1 p-2 rounded-lg border transition-all flex flex-col items-center gap-1",
                    repeatType === "period" 
                      ? "border-primary bg-primary/10" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <span className="text-sm font-sans">Period</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setRepeatType("custom"); setShowRepeatOptions(true); }}
                  className={cn(
                    "flex-1 p-2 rounded-lg border transition-all flex flex-col items-center gap-1",
                    repeatType === "custom" 
                      ? "border-primary bg-primary/10" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <CalendarIcon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-sans">Custom</span>
                </button>
              </div>

              {/* Weekly Options */}
              {repeatType === "weekly" && showRepeatOptions && (
                <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                  <p className="text-xs font-sans text-muted-foreground mb-2">Select days:</p>
                  <div className="flex gap-1 justify-between">
                    {weekDayLabels.map((label, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => toggleWeekDay(index)}
                        className={cn(
                          "w-8 h-8 rounded-full text-xs font-sans font-medium transition-all",
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
                <div className="mt-2 p-2 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-xs font-sans text-muted-foreground">Date range:</p>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="flex-1 text-xs h-8">
                          {periodStart ? format(periodStart, "MMM d") : "Start"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={periodStart}
                          onSelect={setPeriodStart}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="self-center text-muted-foreground text-xs">→</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="flex-1 text-xs h-8">
                          {periodEnd ? format(periodEnd, "MMM d") : "End"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <CalendarComponent
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
                <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                  <p className="text-xs font-sans text-muted-foreground mb-2">Select dates:</p>
                  <CalendarComponent
                    mode="multiple"
                    selected={customDates}
                    onSelect={(dates) => setCustomDates(dates || [])}
                    className="rounded-md border-0"
                  />
                  {customDates.length > 0 && (
                    <p className="text-xs text-primary mt-2 font-sans">
                      {customDates.length} date{customDates.length > 1 ? "s" : ""} selected
                    </p>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 border-t border-border/50">
          {task && onDelete && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={async () => {
                if (confirm("Are you sure you want to delete this task?")) {
                  onDelete(task.id);
                  onClose();
                }
              }}
              className="rounded-xl font-sans border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              {i18n.t("common.delete")}
            </Button>
          )}
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose} 
            className={cn("rounded-xl font-sans", task && onDelete ? "flex-1" : "flex-1")}
          >
            {i18n.t("common.cancel")}
          </Button>
          <Button 
            type="button"
            onClick={() => handleSubmit()}
            className="flex-1 rounded-xl bg-primary text-primary-foreground font-sans"
            disabled={!title.trim() || isSubmitting}
          >
            {isSubmitting ? (task ? i18n.t("common.save") : i18n.t("common.add")) : task ? i18n.t("common.save") : i18n.t("task.add")}
          </Button>
        </div>
      </div>

      {/* Conflict Dialog */}
      <Dialog open={!!conflictInfo} onOpenChange={(open) => {
        if (!open) {
          setConflictInfo(null);
        }
      }}>
        <DialogContent className="max-w-sm w-[calc(100%-3rem)] rounded-3xl p-0 overflow-hidden [&>button]:w-8 [&>button]:h-8 [&>button]:rounded-full [&>button]:bg-muted [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:hover:bg-muted/80 [&>button]:transition-colors [&>button]:right-4 [&>button]:top-4 [&>button]:opacity-100">
          <div className="p-6">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-primary" />
                </div>
                <DialogTitle className="font-sans text-lg font-semibold">
                  Time Conflict
                </DialogTitle>
              </div>
              <DialogDescription className="text-left pt-2">
                {conflictInfo && conflictInfo.conflictingTasks.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm font-sans text-foreground leading-relaxed">
                      This time conflicts with an existing task.
                    </p>
                    <div className="bg-muted/50 rounded-xl p-3 border border-border">
                      <p className="text-sm font-sans text-foreground">
                        <span className="font-medium">"{conflictInfo.conflictingTasks[0].title}"</span> is already scheduled from{" "}
                        <span className="font-medium text-primary">
                          {conflictInfo.conflictingTasks[0].time}
                          {conflictInfo.conflictingTasks[0].endTime && ` - ${conflictInfo.conflictingTasks[0].endTime}`}
                        </span>
                        .
                      </p>
                    </div>
                    <p className="text-sm font-sans text-muted-foreground">
                      Please adjust the time above and try again.
                    </p>
                    {conflictInfo.suggestedAlternative && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleUseSuggestedTime();
                            setConflictInfo(null);
                          }}
                          className="text-sm font-sans font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          Use {conflictInfo.suggestedAlternative.time} instead →
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-sans text-foreground">
                    {conflictInfo?.message || "This time conflicts with an existing task. Please choose a different time."}
                  </p>
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
