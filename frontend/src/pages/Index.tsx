import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { format, isSameDay, parseISO, isToday } from "date-fns";
import { Header } from "@/components/lifeos/Header";
import { QuickMenu } from "@/components/lifeos/QuickMenu";
import { HorizontalDayStrip } from "@/components/lifeos/HorizontalDayStrip";
import { BalanceScoreCard } from "@/components/lifeos/BalanceScoreCard";
import { TaskList } from "@/components/lifeos/TaskList";
import { CheckInButton } from "@/components/lifeos/CheckInButton";
import { BottomNav } from "@/components/lifeos/BottomNav";
import { DailyNoteModal } from "@/components/lifeos/DailyNoteModal";
import { CheckInModal } from "@/components/lifeos/CheckInModal";
import { SetFocusModal } from "@/components/lifeos/SetFocusModal";
import { AddTaskModal } from "@/components/lifeos/AddTaskModal";
import { CoreAIFAB } from "@/components/lifeos/CoreAI/CoreAIFAB";
import { useLifeOSStore } from "@/stores/useLifeOSStore";
import { useCoreAI } from "@/hooks/useCoreAI";
import { Task } from "@/components/lifeos/TaskItem";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Eye, Bell } from "lucide-react";
import { Skeleton, SkeletonCard, SkeletonList } from "@/components/ui/skeleton";



const Index = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [goalNotification, setGoalNotification] = useState<string>("");
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showSetFocus, setShowSetFocus] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showDayStrip, setShowDayStrip] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [existingCheckIn, setExistingCheckIn] = useState<{ 
    id: string; 
    date: string; 
    completedTaskIds: string[]; 
    incompleteTaskIds: string[]; 
    note?: string; 
    mood?: string;
  } | null>(null);
  const [existingPhoto, setExistingPhoto] = useState<{ filename: string; uploadedAt: string } | null>(null);
  
  const store = useLifeOSStore();
  const coreAI = useCoreAI();

  // Load existing check-in and photo when modal opens
  useEffect(() => {
    if (showCheckIn) {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      let cancelled = false;
      
      Promise.all([
        api.getCheckIn(dateStr).catch(() => null),
        store.loadNote(dateStr).catch(() => null)
      ]).then(([checkIn, note]) => {
        if (!cancelled) {
          setExistingCheckIn(checkIn || null);
          // Load photo from note if it exists
          if (note && note.photo && typeof note.photo === 'object' && note.photo.filename) {
            setExistingPhoto(note.photo);
          } else if (note && note.photos && Array.isArray(note.photos) && note.photos.length > 0) {
            setExistingPhoto(note.photos[0]);
          } else {
            setExistingPhoto(null);
          }
        }
      });
      
      return () => {
        cancelled = true;
      };
    } else {
      // Reset when modal closes
      setExistingCheckIn(null);
      setExistingPhoto(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCheckIn, selectedDate]);

    // Load initial data once
    useEffect(() => {
      const loadData = async () => {
        try {
          setLoading(true);
          setError(null);
          await Promise.all([
            store.loadBootstrap(),
            store.loadToday(selectedDate),
            store.loadReminders(),
          ]);
          
          // Removed morning briefing - was too intrusive
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
    // Re-load when the user changes the date
    useEffect(() => {
      store.loadToday(selectedDate);
      // Also reload reminders when date changes to ensure we have latest data
      store.loadReminders();
    }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps
  
    // Memoize date string to avoid recalculating on every render
    const currentDateStr = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate]);

    // Memoize task filtering and processing
    const todayTasks = useMemo(() => {
      return (store.tasks ?? []).filter(t => {
        if (!t.date) return false;
        // Normalize date format for comparison
        let taskDate = t.date;
        if (typeof taskDate === 'string') {
          if (taskDate.includes('T')) taskDate = taskDate.split('T')[0];
          if (taskDate.includes(' ')) taskDate = taskDate.split(' ')[0];
          if (taskDate.length > 10) taskDate = taskDate.substring(0, 10);
        } else if (taskDate instanceof Date) {
          taskDate = taskDate.toISOString().slice(0, 10);
        }
        return taskDate === currentDateStr;
      });
    }, [store.tasks, currentDateStr]);

    // Memoize legacy format conversion
    const legacyTasks: Task[] = useMemo(() => {
      return todayTasks.map(t => ({
        id: t.id,
        title: t.title,
        time: t.time,
        endTime: t.endTime,
        completed: t.completed,
        value: t.value,
      }));
    }, [todayTasks]);

    // Memoize task separation and sorting
    const scheduledTasks = useMemo(() => {
      return legacyTasks.filter(t => t.time).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    }, [legacyTasks]);

    const anytimeTasks = useMemo(() => {
      return legacyTasks.filter(t => !t.time);
    }, [legacyTasks]);

  // Get reminders that should be shown for today
  const todayShowReminders = useMemo(() => {
    if (!store.reminders) return [];
    const currentDateStr = format(selectedDate, "yyyy-MM-dd");
    return store.reminders.filter(r => {
      // Must be "show" type
      if (r.type !== "show") return false;
      // Must be visible
      if (r.visible === false) return false;
      // Must have dueDate that matches today
      if (!r.dueDate) return false;
      try {
        const reminderDate = parseISO(r.dueDate);
        const reminderDateStr = format(reminderDate, "yyyy-MM-dd");
        return reminderDateStr === currentDateStr;
      } catch {
        return false;
      }
    });
  }, [store.reminders, selectedDate]);


  // Memoize task groups
  const taskGroups = useMemo(() => [
    { title: "Scheduled", tasks: scheduledTasks },
    { title: "Anytime", tasks: anytimeTasks },
  ], [scheduledTasks, anytimeTasks]);

  // Memoize completion counts
  const completedCount = useMemo(() => legacyTasks.filter(t => t.completed).length, [legacyTasks]);
  const totalCount = useMemo(() => legacyTasks.length, [legacyTasks]);

  // Memoize energy status mapping
  const mapEnergyStatus = useCallback((backendStatus?: string): "low" | "optimal" | "heavy" => {
    if (!backendStatus) return "optimal";
    switch (backendStatus) {
      case "space_available":
        return "low";
      case "balanced_pacing":
        return "optimal";
      case "prioritize_rest":
        return "heavy";
      default:
        return "optimal";
    }
  }, []);

  const energyStatus = useMemo(() => mapEnergyStatus(store.today?.energy?.status), [store.today?.energy?.status, mapEnergyStatus]);

  const handleAddTask = useCallback(async (task: { 
    title: string; 
    time?: string; 
    endTime?: string; 
    value: string | undefined; 
    date: string; 
    repeat?: { type: string; weekDays?: number[]; startDate?: string; endDate?: string; customDates?: string[] } | undefined 
  }) => {
    try {
      const result = await store.addTask({
        title: task.title,
        time: task.time,
        endTime: task.endTime,
        value: task.value,
        date: task.date,
        completed: false,
        repeat: task.repeat,
      });
      // If conflict, return it so AddTaskModal can handle it (keep modal open)
      if (result && typeof result === 'object' && 'conflict' in result && result.conflict === true) {
        return result; // Return conflict so modal stays open
      }
      // Show goal notification if task matches a goal
      if (result && typeof result === 'object' && 'goalMatch' in result && result.goalMatch) {
        setGoalNotification(result.goalMatch);
      }
      // Task created successfully - modal will close automatically
      // Return the task object for compatibility
      return result?.task || result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add task. Please try again.";
      toast.error(errorMessage);
      throw error; // Re-throw so AddTaskModal can handle it
    }
  }, [store]);
  
  const handleToggleTask = useCallback(async (id: string) => {
    const result = await store.toggleTask(id);
    // Show goal notification if task matches a goal
    if (result && typeof result === 'object' && 'goalMatch' in result && result.goalMatch) {
      setGoalNotification(result.goalMatch);
    }
  }, [store]);

  // Divider between Scheduled & Anytime
  const Divider = () => (
    <div
      className="border-t my-4 mx-4"
      style={{ borderColor: "rgba(143, 87, 116, 0.35)" }}
    />
  );
  

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-sans">Loading Today Page...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <p className="text-destructive mb-2">Error loading app</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-48">
      {/* Top Brand */}
      <p className="text-xs font-sans font-medium text-muted-foreground tracking-widest uppercase text-center pt-4 pb-2">
        LifeOS, powered by SolAI
      </p>

      <div className="flex items-center gap-3 px-4 mb-2">
        <div className="flex-1">
          <Header onTitleClick={() => setShowDayStrip(!showDayStrip)} />
        </div>
        <QuickMenu />
      </div>
      {showDayStrip && (
        <HorizontalDayStrip 
          selectedDate={selectedDate} 
          onDateSelect={(date) => {
            setSelectedDate(date);
            setShowDayStrip(false);
          }} 
        />
      )}

      {/* Today's Show Reminders - Before Energy Status */}
      {todayShowReminders.length > 0 && (
        <div className="px-4 py-2 mt-2">
          <div className="space-y-2">
            {todayShowReminders.map((reminder) => (
              <div
                key={reminder.id}
                className="flex items-center gap-3"
              >
                <Bell className="w-4 h-4 text-primary animate-bell-ring flex-shrink-0" style={{ color: 'hsl(330 26% 45%)', fill: 'hsl(330 26% 45%)' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-sans font-medium text-sm text-foreground">
                    {reminder.title}
                  </p>
                  {reminder.note && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {reminder.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="mt-4">
        <BalanceScoreCard 
          status={energyStatus} 
          tasksCompleted={completedCount}
          totalTasks={totalCount}
        />
      </div>
      
       {/* Scheduled */}
      <TaskList
        groups={[{ title: "Scheduled", tasks: scheduledTasks }]}
        onToggleTask={handleToggleTask}
        onDeleteTask={store.deleteTask}
        onUpdateTask={async (id, updates) => {
          await store.updateTask(id, updates);
          // Reload today's tasks after update
          await store.loadTasksForDate(selectedDate);
        }}
        onAddTask={() => setShowAddTask(true)}
      />

      {/* Divider ONLY if both exist */}
      {scheduledTasks.length > 0 && anytimeTasks.length > 0 && (
        <div className="border-t border-muted my-4 opacity-50 mx-4" />
      )}

      {/* Anytime */}
      <TaskList
        groups={[{ title: "Anytime", tasks: anytimeTasks }]}
        onToggleTask={handleToggleTask}
        onDeleteTask={store.deleteTask}
        onUpdateTask={async (id, updates) => {
          await store.updateTask(id, updates);
          // Reload today's tasks after update
          await store.loadTasksForDate(selectedDate);
        }}
      />

      
      <CheckInButton onClick={() => setShowCheckIn(true)} />
      
      <BottomNav />
      
      <CoreAIFAB
        messages={coreAI.messages}
        onSendMessage={coreAI.sendMessage}
        onConfirmAction={coreAI.confirmAction}
        isLoading={coreAI.isLoading}
        aiName={store.settings.coreAIName}
        onClearHistory={coreAI.clearHistory}
        currentView="today"
        selectedDate={format(selectedDate, "yyyy-MM-dd")}
        goalNotification={goalNotification}
      />
      
      <CheckInModal
        isOpen={showCheckIn}
        onClose={() => {
          setShowCheckIn(false);
          setExistingCheckIn(null);
        }}
        date={selectedDate}
        tasks={todayTasks}
        onToggleTask={handleToggleTask}
        onMoveTask={store.moveTask}
        onComplete={async (completedIds, incompleteIds, movedTasks, note, mood, photo) => {
          await store.saveCheckIn(selectedDate, completedIds, incompleteIds, movedTasks, note, mood);
          // Also save note with photo if provided (photos are stored with notes, not check-ins)
          if (photo || note) {
            await store.saveNote({
              date: format(selectedDate, "yyyy-MM-dd"),
              content: note || "",
              photo: photo || null,
            });
          }
          setShowCheckIn(false);
          setExistingCheckIn(null);
          setExistingPhoto(null);
        }}
        existingCheckIn={existingCheckIn}
        existingPhoto={existingPhoto}
      />
      
      
      <SetFocusModal
        isOpen={showSetFocus}
        onClose={() => setShowSetFocus(false)}
        onSave={(title, description) => store.setCurrentMonthFocus(title, description)}
      />

      <AddTaskModal
        isOpen={showAddTask}
        onClose={() => setShowAddTask(false)}
        onAdd={handleAddTask}
        date={format(selectedDate, "yyyy-MM-dd")}
      />
    </div>
  );
};

export default Index;