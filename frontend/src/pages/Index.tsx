import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format, isSameDay, parseISO } from "date-fns";
import { Header } from "@/components/lifeos/Header";
import { SideMenu, SideMenuButton } from "@/components/lifeos/SideMenu";
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



const Index = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [goalNotification, setGoalNotification] = useState<string>("");
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showSetFocus, setShowSetFocus] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showDayStrip, setShowDayStrip] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [existingCheckIn, setExistingCheckIn] = useState<any>(null);
  const [existingPhoto, setExistingPhoto] = useState<{ filename: string; uploadedAt: string } | null>(null);
  const [showSideMenu, setShowSideMenu] = useState(false);
  
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
  
    // Filter tasks for the selected date
    const currentDateStr = format(selectedDate, "yyyy-MM-dd");
    const todayTasks = (store.tasks ?? []).filter(t => {
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

  const handleAddTask = async (task: { title: string; time?: string; endTime?: string; value: any; date: string; repeat?: any }) => {
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
      return result;
    } catch (error: any) {
      toast.error(error?.message || "Failed to add task. Please try again.");
      throw error; // Re-throw so AddTaskModal can handle it
    }
  };
  
  const handleToggleTask = async (id: string) => {
    const result = await store.toggleTask(id);
    // Show goal notification if task matches a goal
    if (result && result.goalMatch) {
      setGoalNotification(result.goalMatch);
    }
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

      <SideMenu isOpen={showSideMenu} onClose={() => setShowSideMenu(false)} />
      
      <div className="flex items-center gap-3 px-4">
        <SideMenuButton onClick={() => setShowSideMenu(true)} />
        <div className="flex-1">
          <Header onTitleClick={() => setShowDayStrip(!showDayStrip)} />
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