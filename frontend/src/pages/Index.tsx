import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format, isSameDay, parseISO } from "date-fns";
import { Settings, Bell } from "lucide-react";
import { Header } from "@/components/lifeos/Header";
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



const Index = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showSetFocus, setShowSetFocus] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showDayStrip, setShowDayStrip] = useState(true);
  const [animateBell, setAnimateBell] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const store = useLifeOSStore();
  const coreAI = useCoreAI();

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
        } catch (err) {
          console.error("Failed to load data:", err);
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
  
    const todayTasks = store.tasks ?? [];

  // Convert to legacy format for TaskList
  const legacyTasks: Task[] = todayTasks.map(t => ({
    id: t.id,
    title: t.title,
    time: t.time,
    endTime: t.endTime,
    completed: t.completed,
    value: t.value,
  }));

  // Separate scheduled tasks (with time) from anytime tasks (without time)
  const scheduledTasks = legacyTasks.filter(t => t.time).sort((a, b) => (a.time || "").localeCompare(b.time || ""));;
  const anytimeTasks = legacyTasks.filter(t => !t.time);


  const taskGroups = [
    { title: "Scheduled", tasks: scheduledTasks },
    { title: "Anytime", tasks: anytimeTasks },
  ];  


  const completedCount = legacyTasks.filter(t => t.completed).length;
  const totalCount = legacyTasks.length;

  // Get energy status from backend (no frontend calculation)
  // Energy status reflects PLANNED LOAD for the day and remains FIXED regardless of task completion
  // The status represents how demanding today's schedule is overall - it does not change as tasks are completed
  // Task completion only affects the progress bar visualization, not the energy classification
  const mapEnergyStatus = (backendStatus?: string): "low" | "optimal" | "heavy" => {
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
  };

  const energyStatus = mapEnergyStatus(store.today?.energy?.status);

  // Get "show" type reminders for the selected date
  // Only show reminders that match the selected date exactly
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  
  // Debug: log all reminders first
  console.log("=== SHOW REMINDERS DEBUG ===");
  console.log("All reminders from store:", store.reminders);
  console.log("Selected date:", selectedDateStr);
  console.log("Selected date object:", selectedDate);
  
  const showReminders = (store.reminders || []).filter(r => {
    // Debug each reminder
    console.log("Checking reminder:", {
      id: r.id,
      title: r.title,
      type: r.type,
      dueDate: r.dueDate,
      visible: r.visible
    });
    
    // Check type first
    if (r.type !== "show") {
      console.log("  -> Not 'show' type, skipping");
      return false;
    }
    if (r.visible === false) {
      console.log("  -> Not visible, skipping");
      return false;
    }
    // Must have a dueDate and it must match the selected date
    if (!r.dueDate) {
      console.log("  -> No dueDate, skipping");
      return false;
    }
    try {
      // Extract just the date part (YYYY-MM-DD) from the reminder's dueDate
      // Handle both ISO format (with time) and date-only format (YYYY-MM-DD)
      const reminderDateOnly = r.dueDate.split('T')[0]; // Get just the date part
      const matches = reminderDateOnly === selectedDateStr;
      
      console.log("  -> Date comparison:", {
        reminderDateOnly,
        selectedDateStr,
        matches
      });
      
      return matches;
    } catch (error) {
      console.error("  -> Error parsing reminder date:", r.dueDate, error);
      return false;
    }
  });
  
  console.log("Filtered show reminders:", showReminders);
  console.log("=== END DEBUG ===");

  // Animate bell for first 5 seconds when reminders are present
  useEffect(() => {
    if (showReminders.length > 0 && !loading) {
      setAnimateBell(true);
      const timer = setTimeout(() => {
        setAnimateBell(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showReminders.length, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddTask = (task: { title: string; time?: string; endTime?: string; value: any; date: string }) => {
    store.addTask({
      title: task.title,
      time: task.time,
      endTime: task.endTime,
      value: task.value,
      date: task.date,
      completed: false,
    });
  };

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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading LifeOS...</p>
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
      <p className="text-xs font-sans font-medium text-muted-foreground tracking-widest uppercase text-center pt-4 pb-1">
        LifeOS, powered by SolAI
      </p>

      <div className="flex items-center justify-between px-4">
        <div className="flex-1">
          <Header onTitleClick={() => setShowDayStrip(!showDayStrip)} />
        </div>
        <div className="flex items-center gap-2">
        <Link to="/reminders" className="relative w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <Bell className="w-4 h-4 text-muted-foreground" />
            {store.reminders.filter(r => r.visible).length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                {store.reminders.filter(r => r.visible).length}
              </span>
            )}
          </Link>
          <Link to="/settings" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </Link>
        </div>
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
      
      {/* Show Reminders - displayed before Energy Status */}
      {showReminders.length > 0 && (
        <div className="mt-4 px-4">
          <div className="space-y-3">
            {showReminders.map((reminder) => (
              <div
                key={reminder.id}
                className="flex items-start gap-3"
              >
                <Bell 
                  className={cn(
                    "w-5 h-5 flex-shrink-0 mt-0.5 text-primary",
                    animateBell && "animate-bell-ring"
                  )} 
                  style={{ fill: 'currentColor', strokeWidth: 1.5 }} 
                />
                <div className="flex-1 min-w-0">
                  <p className="font-sans font-medium text-foreground text-base">{reminder.title}</p>
                  {reminder.note && (
                    <p className="text-sm text-muted-foreground mt-1">{reminder.note}</p>
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
        onToggleTask={store.toggleTask}
        onDeleteTask={store.deleteTask}
        onAddTask={() => setShowAddTask(true)}
      />

      {/* Divider ONLY if both exist */}
      {scheduledTasks.length > 0 && anytimeTasks.length > 0 && (
        <div className="border-t border-muted my-4 opacity-50 mx-4" />
      )}

      {/* Anytime */}
      <TaskList
        groups={[{ title: "Anytime", tasks: anytimeTasks }]}
        onToggleTask={store.toggleTask}
        onDeleteTask={store.deleteTask}
      />

      
      <CheckInButton onClick={() => setShowCheckIn(true)} />
      
      <BottomNav />
      
      <CoreAIFAB
        messages={coreAI.messages}
        onSendMessage={coreAI.sendMessage}
        isLoading={coreAI.isLoading}
        aiName={store.settings.coreAIName}
      />
      
      <CheckInModal
        isOpen={showCheckIn}
        onClose={() => setShowCheckIn(false)}
        date={selectedDate}
        tasks={todayTasks}
        onToggleTask={store.toggleTask}
        onMoveTask={store.moveTask}
        onComplete={(completedIds, incompleteIds, movedTasks, note, mood) => {
          store.saveCheckIn(selectedDate, completedIds, incompleteIds, movedTasks, note, mood);
          setShowCheckIn(false);
        }}
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