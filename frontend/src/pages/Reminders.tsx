import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell, Plus, Clock, Calendar as CalendarIcon, ChevronRight, Edit2, Trash2, ArrowLeft, Eye, X, Repeat, CalendarDays } from "lucide-react";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TopBrand } from "@/components/lifeos/TopBrand";
import { BottomNav } from "@/components/lifeos/BottomNav";
import { CoreAIFAB } from "@/components/lifeos/CoreAI/CoreAIFAB";
import { useLifeOSStore } from "@/stores/useLifeOSStore";
import { useCoreAI } from "@/hooks/useCoreAI";
import { Reminder } from "@/types/lifeos";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimePicker } from "@/components/lifeos/TimePicker";

const typeConfig = {
  notify: {
    label: "Notify",
    icon: Bell,
    color: "text-primary",
    bg: "bg-primary/10"
  },
  show: {
    label: "Show",
    icon: Eye,
    color: "text-muted-foreground",
    bg: "bg-muted/50"
  }
};
export default function Reminders() {
  const store = useLifeOSStore();
  const coreAI = useCoreAI();
  const [isAddingReminder, setIsAddingReminder] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [isLoadingReminders, setIsLoadingReminders] = useState(false);

  // Load reminders from backend on mount - prioritize backend over localStorage
  useEffect(() => {
    const loadData = async () => {
      setIsLoadingReminders(true);
      try {
        await store.loadReminders();
      } catch (error) {
      } finally {
        setIsLoadingReminders(false);
      }
    };
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Form state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [type, setType] = useState<"notify" | "show">("notify");
  const [note, setNote] = useState("");
  
  // Repeat state
  type RepeatType = "none" | "weekly" | "period" | "custom";
  const [repeatType, setRepeatType] = useState<RepeatType>("none");
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>([]);
  const [periodStart, setPeriodStart] = useState<Date | undefined>();
  const [periodEnd, setPeriodEnd] = useState<Date | undefined>();
  const [customDates, setCustomDates] = useState<Date[]>([]);
  const [showRepeatOptions, setShowRepeatOptions] = useState(false);
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  
  const weekDayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  
  const toggleWeekDay = (dayIndex: number) => {
    setSelectedWeekDays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };
  
  const resetForm = () => {
    setTitle("");
    setDate("");
    setTime("");
    setType("notify");
    setNote("");
    setRepeatType("none");
    setSelectedWeekDays([]);
    setPeriodStart(undefined);
    setPeriodEnd(undefined);
    setCustomDates([]);
    setShowRepeatOptions(false);
    setShowRepeatPicker(false);
  };
  const openEditModal = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setTitle(reminder.title);
    setDate(reminder.dueDate || "");
    setTime(reminder.time || "");
    // Ensure type is properly set - check if it's a valid type
    const reminderType = reminder.type === "show" || reminder.type === "notify" ? reminder.type : "notify";
    setType(reminderType);
    setNote(reminder.note || "");
    
    // Load repeat config if it exists
    if ((reminder as any).repeat) {
      const repeat = (reminder as any).repeat;
      setRepeatType(repeat.type || "none");
      setSelectedWeekDays(repeat.weekDays || []);
      setPeriodStart(repeat.startDate ? parseISO(repeat.startDate) : undefined);
      setPeriodEnd(repeat.endDate ? parseISO(repeat.endDate) : undefined);
      setCustomDates(repeat.customDates ? repeat.customDates.map((d: string) => parseISO(d)) : []);
      setShowRepeatOptions(repeat.type !== "none");
      setShowRepeatPicker(repeat.type !== "none");
    } else {
      setRepeatType("none");
      setSelectedWeekDays([]);
      setPeriodStart(undefined);
      setPeriodEnd(undefined);
      setCustomDates([]);
      setShowRepeatOptions(false);
      setShowRepeatPicker(false);
    }
    
  };
  const handleSave = async () => {
    if (!title.trim()) return;
    // For "notify" type, date and time are required
    if (type === "notify" && (!date || !time)) {
      return; // Don't save if required fields are missing
    }
    
    const repeatConfig = repeatType !== "none" ? {
      type: repeatType,
      weekDays: repeatType === "weekly" ? selectedWeekDays : undefined,
      startDate: repeatType === "period" && periodStart ? format(periodStart, "yyyy-MM-dd") : undefined,
      endDate: repeatType === "period" && periodEnd ? format(periodEnd, "yyyy-MM-dd") : undefined,
      customDates: repeatType === "custom" ? customDates.map(d => format(d, "yyyy-MM-dd")) : undefined,
    } : undefined;
    
    const reminderData = {
      title: title.trim(),
      dueDate: date || undefined,
      time: time || undefined,
      type: type || "notify", // Ensure type is always set
      note: note.trim() || undefined,
      repeat: repeatConfig,
      visible: true
    };
    if (editingReminder) {
      await store.updateReminder(editingReminder.id, reminderData);
      setEditingReminder(null);
      // Reload reminders to get updated data from backend
      await store.loadReminders();
    } else {
      await store.addReminder(reminderData);
      setIsAddingReminder(false);
      // Reload reminders to get fresh data from backend
      await store.loadReminders();
    }
    resetForm();
  };
  const handleDelete = async (id: string) => {
    await store.deleteReminder(id);
    setEditingReminder(null);
    // Reload reminders to get fresh data from backend
    await store.loadReminders();
  };
  const closeModal = () => {
    setIsAddingReminder(false);
    setEditingReminder(null);
    resetForm();
  };

  // Group reminders - include reminders without dates in "Upcoming"
  // Safely filter reminders with error handling
  // Filter by visible if the property exists, otherwise show all
  const allReminders = (store.reminders || []).filter(r => r.visible !== false);
  const todayReminders = allReminders.filter(r => {
    if (!r.dueDate) return false;
    try {
      return isToday(parseISO(r.dueDate));
    } catch {
      return false;
    }
  });
  const upcomingReminders = allReminders.filter(r => {
    if (!r.dueDate) return true; // Show reminders without dates
    try {
      const date = parseISO(r.dueDate);
      return !isToday(date) && !isPast(date);
    } catch {
      return true; // If date parsing fails, show in upcoming
    }
  }).sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return -1; // No date comes first
    if (!b.dueDate) return 1;
    return (a.dueDate || "").localeCompare(b.dueDate || "");
  });
  const pastReminders = allReminders.filter(r => {
    if (!r.dueDate) return false;
    try {
      const date = parseISO(r.dueDate);
      return isPast(date) && !isToday(date);
    } catch {
      return false;
    }
  });
  const formatReminderDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d, yyyy");
  };
  const ReminderCard = ({
    reminder
  }: {
    reminder: Reminder;
  }) => {
    const config = typeConfig[reminder.type || "notify"];
    const TypeIcon = config.icon;
    return <div onClick={() => openEditModal(reminder)} className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border/50 hover:border-border transition-all cursor-pointer group">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", config.bg)}>
          <TypeIcon className={cn("w-5 h-5", config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans font-medium text-foreground">{reminder.title}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {reminder.dueDate && <span className="flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" />
                {formatReminderDate(reminder.dueDate)}
              </span>}
            {reminder.time && <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {reminder.time}
              </span>}
          </div>
          {reminder.note && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{reminder.note}</p>}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>;
  };
  return <div className="min-h-screen bg-background pb-24">
      <TopBrand />
      
      <div className="px-4 pt-4 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl text-foreground font-sans font-semibold">Reminders</h1>
              <p className="text-sm text-muted-foreground mt-1">Never miss what matters</p>
            </div>
          </div>
          <Button onClick={() => setIsAddingReminder(true)} size="sm" className="rounded-full gap-1">
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>

        {/* Loading State - Show only while loading */}
        {isLoadingReminders && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Today's Reminders */}
        {!isLoadingReminders && todayReminders.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Today
            </h2>
            <div className="space-y-2">
              {todayReminders.map(reminder => <ReminderCard key={reminder.id} reminder={reminder} />)}
            </div>
          </div>
        )}

        {/* Upcoming Reminders */}
        {!isLoadingReminders && upcomingReminders.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Upcoming
            </h2>
            <div className="space-y-2">
              {upcomingReminders.map(reminder => <ReminderCard key={reminder.id} reminder={reminder} />)}
            </div>
          </div>
        )}

        {/* Past Reminders */}
        {!isLoadingReminders && pastReminders.length > 0 && (
          <div className="mb-6 opacity-60">
            <h2 className="text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Past
            </h2>
            <div className="space-y-2">
              {pastReminders.map(reminder => <ReminderCard key={reminder.id} reminder={reminder} />)}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoadingReminders && allReminders.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg text-foreground mb-2 font-sans">No reminders yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add reminders for birthdays, follow-ups, and personal moments
            </p>
            <Button onClick={() => setIsAddingReminder(true)} variant="outline" className="rounded-full">
              <Plus className="w-4 h-4 mr-2" />
              Add your first reminder
            </Button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(isAddingReminder || editingReminder) && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-6">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={closeModal}
          />
          
          {/* Modal */}
          <div className="relative bg-card rounded-3xl shadow-card w-full max-w-sm animate-scale-in overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h3 className="font-sans text-lg font-semibold text-foreground">
                {editingReminder ? "Edit Reminder" : "New Reminder"}
              </h3>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="min-h-[280px] max-h-[320px] overflow-y-auto">
              <div className="p-4 space-y-4">
                {/* Title Input - Dominant */}
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="What do you want to remember?"
                  className="text-lg font-sans py-3 font-medium"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (title.trim()) handleSave();
                    }
                  }}
                />

                {/* Type Selection - Under Title */}
                <div>
                  <Select value={type} onValueChange={(v: "notify" | "show") => {
                    setType(v);
                    // When switching to "show", clear time if it was set
                    if (v === "show") {
                      setTime("");
                    }
                  }}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="notify">
                        <span className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-primary" />
                          Notify
                        </span>
                      </SelectItem>
                      <SelectItem value="show">
                        <span className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-muted-foreground" />
                          Show
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Quick Action Row - Icon Buttons */}
                <div className="flex items-center gap-2">
                  {/* Date Button */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center transition-all relative",
                          date
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <CalendarIcon className="w-4 h-4" />
                        {date && (
                          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border border-card" />
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={date ? new Date(date) : undefined}
                        onSelect={(selectedDate) => {
                          if (selectedDate) {
                            setDate(format(selectedDate, "yyyy-MM-dd"));
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Time Button (only if Notify type) */}
                  {type === "notify" && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                            time
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-4" align="start">
                        <TimePicker
                          value={time}
                          onChange={setTime}
                        />
                      </PopoverContent>
                    </Popover>
                  )}

                  {/* Repeat Button */}
                  <button
                    type="button"
                    onClick={() => setShowRepeatPicker(!showRepeatPicker)}
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                      repeatType !== "none"
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Repeat className="w-4 h-4" />
                  </button>
                </div>

                {/* Date/Time Display */}
                {(date || (type === "notify" && time)) && (
                  <div className="text-xs text-muted-foreground font-sans px-1">
                    {date && (() => {
                      try {
                        return format(new Date(date), "EEEE, MMMM d");
                      } catch {
                        return date;
                      }
                    })()}
                    {type === "notify" && time && date && ` at ${time}`}
                    {type === "notify" && time && !date && time}
                  </div>
                )}

                {/* Make Recurring Options - Shown when repeat button is clicked */}
                {showRepeatPicker && (
                  <div className="p-3 bg-muted/30 rounded-xl space-y-3 border border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-sans font-medium text-foreground">Make Recurring</span>
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
                        <span className="text-xs font-sans">Weekly</span>
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
                        <span className="text-xs font-sans">Period</span>
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
                        <span className="text-xs font-sans">Custom</span>
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
                )}

                {/* Note */}
                <div>
                  <Textarea 
                    placeholder="Note (optional)" 
                    value={note} 
                    onChange={e => setNote(e.target.value)} 
                    className="resize-none text-sm" 
                    rows={3} 
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 p-4 border-t border-border/50">
              {editingReminder && (
                <Button 
                  variant="outline" 
                  onClick={() => handleDelete(editingReminder.id)} 
                  className="text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={closeModal} 
                className={editingReminder ? "flex-1 rounded-xl font-sans" : "flex-1 rounded-xl font-sans"}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                className="flex-1 rounded-xl bg-primary text-primary-foreground font-sans"
                disabled={!title.trim() || (type === "notify" && (!date || !time))}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
      <CoreAIFAB 
        messages={coreAI.messages} 
        onSendMessage={coreAI.sendMessage}
        onConfirmAction={coreAI.confirmAction}
        isLoading={coreAI.isLoading} 
        aiName={store.settings.coreAIName}
        onClearHistory={coreAI.clearHistory}
        currentView="reminders"
      />
    </div>;
}