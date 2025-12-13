import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Bell, Plus, Clock, Calendar as CalendarIcon, ChevronRight, Edit2, Trash2, ArrowLeft, Eye } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Scrollable Time Picker Component
function ScrollableTimePicker({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  const parseTime = (timeStr: string) => {
    if (timeStr && timeStr.includes(':')) {
      const [h, m] = timeStr.split(':').map(Number);
      return { hours: isNaN(h) ? 9 : Math.max(0, Math.min(23, h)), minutes: isNaN(m) ? 0 : Math.max(0, Math.min(59, m)) };
    }
    return { hours: 9, minutes: 0 };
  };

  const { hours: initialHours, minutes: initialMinutes } = parseTime(value);
  const [hours, setHours] = useState(initialHours);
  const [minutes, setMinutes] = useState(initialMinutes);

  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  const isUserScrolling = useRef({ hours: false, minutes: false });

  // Update time when hours or minutes change (but not on initial mount)
  useEffect(() => {
    if (isInitialized.current) {
      const h = hours.toString().padStart(2, '0');
      const m = minutes.toString().padStart(2, '0');
      onChange(`${h}:${m}`);
    }
  }, [hours, minutes, onChange]);

  // Sync with external value changes (only if not user scrolling)
  useEffect(() => {
    if (!isUserScrolling.current.hours && !isUserScrolling.current.minutes) {
      const { hours: newHours, minutes: newMinutes } = parseTime(value);
      if (newHours !== hours) setHours(newHours);
      if (newMinutes !== minutes) setMinutes(newMinutes);
    }
  }, [value]);

  // Initialize scroll position on mount only
  useEffect(() => {
    if (!isInitialized.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (hoursRef.current) {
            const scrollTop = hours * 40 + 80;
            hoursRef.current.scrollTop = scrollTop;
          }
          if (minutesRef.current) {
            const scrollTop = minutes * 40 + 80;
            minutesRef.current.scrollTop = scrollTop;
          }
          isInitialized.current = true;
        }, 50);
      });
    }
  }, []);

  const hoursList = Array.from({ length: 24 }, (_, i) => i);
  const minutesList = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="flex items-center gap-3 p-4 bg-background" style={{ minWidth: '200px' }}>
      {/* Hours Column */}
      <div className="relative" style={{ width: '60px', height: '192px' }}>
        <div 
          ref={hoursRef}
          className="absolute inset-0 overflow-y-auto scrollbar-hide"
          style={{ 
            scrollSnapType: 'y mandatory',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y'
          }}
          onScroll={(e) => {
            isUserScrolling.current.hours = true;
            const scrollTop = e.currentTarget.scrollTop;
            const itemHeight = 40;
            const selectedIndex = Math.round((scrollTop - 80) / itemHeight);
            if (selectedIndex >= 0 && selectedIndex < 24 && selectedIndex !== hours) {
              setHours(selectedIndex);
            }
            // Reset flag after scroll ends
            clearTimeout((window as any).hoursScrollTimeout);
            (window as any).hoursScrollTimeout = setTimeout(() => {
              isUserScrolling.current.hours = false;
            }, 150);
          }}
        >
          <div style={{ height: '80px' }} />
          {hoursList.map((h) => (
            <div
              key={h}
              className={cn(
                "h-10 flex items-center justify-center text-sm font-sans cursor-pointer transition-colors",
                hours === h 
                  ? "text-foreground font-semibold" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              style={{ scrollSnapAlign: 'center' }}
              onClick={() => {
                setHours(h);
                hoursRef.current?.scrollTo({ top: h * 40 + 80, behavior: 'smooth' });
              }}
            >
              {h.toString().padStart(2, '0')}
            </div>
          ))}
          <div style={{ height: '80px' }} />
        </div>
        {/* Selection indicator */}
        <div className="absolute top-1/2 left-0 right-0 h-10 -translate-y-1/2 border-y border-muted-foreground/20 pointer-events-none z-10" />
      </div>

      <div className="text-lg text-muted-foreground font-semibold">:</div>

      {/* Minutes Column */}
      <div className="relative" style={{ width: '60px', height: '192px' }}>
        <div 
          ref={minutesRef}
          className="absolute inset-0 overflow-y-auto scrollbar-hide"
          style={{ 
            scrollSnapType: 'y mandatory',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y'
          }}
          onScroll={(e) => {
            isUserScrolling.current.minutes = true;
            const scrollTop = e.currentTarget.scrollTop;
            const itemHeight = 40;
            const selectedIndex = Math.round((scrollTop - 80) / itemHeight);
            if (selectedIndex >= 0 && selectedIndex < 60 && selectedIndex !== minutes) {
              setMinutes(selectedIndex);
            }
            // Reset flag after scroll ends
            clearTimeout((window as any).minutesScrollTimeout);
            (window as any).minutesScrollTimeout = setTimeout(() => {
              isUserScrolling.current.minutes = false;
            }, 150);
          }}
        >
          <div style={{ height: '80px' }} />
          {minutesList.map((m) => (
            <div
              key={m}
              className={cn(
                "h-10 flex items-center justify-center text-sm font-sans cursor-pointer transition-colors",
                minutes === m 
                  ? "text-foreground font-semibold" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              style={{ scrollSnapAlign: 'center' }}
              onClick={() => {
                setMinutes(m);
                minutesRef.current?.scrollTo({ top: m * 40 + 80, behavior: 'smooth' });
              }}
            >
              {m.toString().padStart(2, '0')}
            </div>
          ))}
          <div style={{ height: '80px' }} />
        </div>
        {/* Selection indicator */}
        <div className="absolute top-1/2 left-0 right-0 h-10 -translate-y-1/2 border-y border-muted-foreground/20 pointer-events-none z-10" />
      </div>
    </div>
  );
}

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
        console.log("📋 Reminders loaded:", store.reminders?.length || 0);
        console.log("📋 Reminders data:", store.reminders);
      } catch (error) {
        console.error("Failed to load reminders:", error);
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
  const resetForm = () => {
    setTitle("");
    setDate("");
    setTime("");
    setType("notify");
    setNote("");
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
    // Debug logging
    console.log("Editing reminder:", {
      id: reminder.id,
      title: reminder.title,
      type: reminder.type,
      savedType: reminderType,
      dueDate: reminder.dueDate
    });
  };
  const handleSave = async () => {
    if (!title.trim()) return;
    // For "notify" type, date and time are required
    if (type === "notify" && (!date || !time)) {
      return; // Don't save if required fields are missing
    }
    const reminderData = {
      title: title.trim(),
      dueDate: date || undefined,
      time: time || undefined,
      type: type || "notify", // Ensure type is always set
      note: note.trim() || undefined,
      visible: true
    };
    // Debug logging
    console.log("💾 Saving reminder:", reminderData);
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
      <Dialog open={isAddingReminder || !!editingReminder} onOpenChange={closeModal}>
        <DialogContent className="w-full max-w-sm p-0 gap-0 rounded-3xl mx-4 sm:mx-auto">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="font-sans font-semibold text-lg">
              {editingReminder ? "Edit Reminder" : "New Reminder"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 px-4 pb-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Title
              </label>
              <Input placeholder="What do you want to remember?" value={title} onChange={e => setTitle(e.target.value)} className="mt-1.5" autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Date
                </label>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Input 
                    type="text" 
                    placeholder={type === "notify" ? "YYYY-MM-DD" : "Optional"}
                    value={date} 
                    onChange={e => setDate(e.target.value)} 
                    className="flex-1 text-sm"
                    required={type === "notify"}
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className={cn(
                          "h-9 w-9 shrink-0 border-muted-foreground/30 hover:bg-muted hover:border-muted-foreground/50",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={date ? new Date(date) : undefined}
                        onSelect={(selectedDate) => {
                          if (selectedDate) {
                            setDate(format(selectedDate, "yyyy-MM-dd"));
                          }
                        }}
                        initialFocus
                        className="rounded-md border-0"
                        classNames={{
                          day_selected: "bg-muted-foreground/20 text-foreground hover:bg-muted-foreground/30 hover:text-foreground focus:bg-muted-foreground/30 focus:text-foreground",
                          nav_button: "border-muted-foreground/30 text-muted-foreground hover:bg-muted hover:border-muted-foreground/50",
                          day_today: "after:bg-muted-foreground",
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Time
                </label>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Input 
                    type="text" 
                    placeholder={type === "notify" ? "09:00" : "--:--"}
                    value={time} 
                    onChange={e => {
                      let value = e.target.value;
                      // Allow --:-- placeholder for Show type
                      if (type === "show" && value === "--:--") {
                        setTime("");
                        return;
                      }
                      // Remove any non-digit characters except colon
                      value = value.replace(/[^\d:]/g, '');
                      // Auto-format as user types (HH:MM)
                      if (value.length === 2 && !value.includes(':')) {
                        value = value + ':';
                      }
                      // Limit to HH:MM format
                      if (value.length <= 5 && (/^([0-1]?[0-9]|2[0-3]):?([0-5]?[0-9])?$/.test(value) || value === "")) {
                        setTime(value);
                      }
                    }}
                    onBlur={(e) => {
                      // Validate and format on blur
                      const value = e.target.value;
                      if (value && !value.includes(':')) {
                        // If user typed just numbers, format it
                        if (value.length === 3) {
                          setTime(value.slice(0, 1) + ':' + value.slice(1));
                        } else if (value.length === 4) {
                          setTime(value.slice(0, 2) + ':' + value.slice(2));
                        }
                      }
                    }}
                    className="flex-1 text-sm"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className={cn(
                          "h-9 w-9 shrink-0 border-muted-foreground/30 hover:bg-muted hover:border-muted-foreground/50",
                          !time && "text-muted-foreground"
                        )}
                      >
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                      <ScrollableTimePicker value={time} onChange={setTime} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Type
              </label>
              <Select value={type} onValueChange={(v: "notify" | "show") => {
                setType(v);
                // When switching to "show", clear time if it was set
                if (v === "show") {
                  setTime("");
                }
              }}>
                <SelectTrigger className="mt-1.5">
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

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Note (optional)
              </label>
              <Textarea placeholder="Add any additional details..." value={note} onChange={e => setNote(e.target.value)} className="mt-1.5 resize-none text-sm" rows={2} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} className="flex-1" size="sm">
                Save
              </Button>
              {editingReminder && <Button variant="outline" size="sm" onClick={() => handleDelete(editingReminder.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
      <CoreAIFAB messages={coreAI.messages} onSendMessage={coreAI.sendMessage} isLoading={coreAI.isLoading} aiName={store.settings.coreAIName} />
    </div>;
}