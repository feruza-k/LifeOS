import { useState, useEffect, useMemo } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { BottomNav } from "@/components/lifeos/BottomNav";
import { cn } from "@/lib/utils";
import { useLifeOSStore } from "@/stores/useLifeOSStore";
import { ValueTag, ValueType } from "@/components/lifeos/ValueTag";
import { CoreAIFAB } from "@/components/lifeos/CoreAI/CoreAIFAB";
import { useCoreAI } from "@/hooks/useCoreAI";

const Week = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const today = new Date();
  
  const weekStart = useMemo(() => startOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const store = useLifeOSStore();
  const coreAI = useCoreAI();

  // Load tasks for the week when component mounts or week changes
  useEffect(() => {
    const loadWeekTasks = async () => {
      try {
        setLoading(true);
        // We only depend on the values of weekStart and weekEnd, not the objects themselves
        // startOfWeek and addDays return new objects, but useMemo keeps them stable
        await store.loadTasksForDateRange(weekStart, weekEnd);
      } catch (error) {
        console.error("Failed to load week tasks:", error);
      } finally {
        setLoading(false);
      }
    };
    loadWeekTasks();
  }, [weekStart, weekEnd, store.loadTasksForDateRange]);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      date,
      tasks: store.getTasksForDateSync(date),
      isToday: isSameDay(date, today),
    };
  });

  const navigateWeek = (direction: number) => {
    setCurrentWeek(prev => addDays(prev, direction * 7));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground font-sans">Loading week...</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Top Brand */}
      <p className="text-xs font-sans font-medium text-muted-foreground tracking-widest uppercase text-center pt-4 pb-2">
        LifeOS, powered by SolAI
      </p>

      {/* Header */}
      <header className="px-6 pb-4 animate-fade-in text-center">
        <h1 className="text-2xl font-serif font-medium text-foreground">
          Weekly Overview
        </h1>
      </header>

      {/* Week Navigation */}
      <div className="px-4 py-2 flex items-center justify-between animate-slide-up">
        <button 
          onClick={() => navigateWeek(-1)}
          className="w-10 h-10 rounded-full bg-card shadow-soft flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        
        <h2 className="font-sans font-semibold text-foreground">
          {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </h2>
        
        <button 
          onClick={() => navigateWeek(1)}
          className="w-10 h-10 rounded-full bg-card shadow-soft flex items-center justify-center"
        >
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Week Days - Vertical List */}
      <div className="px-4 py-4 space-y-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
        {weekDays.map((day) => (
          <div
            key={day.date.toISOString()}
            className={cn(
              "rounded-2xl p-4 transition-all duration-200",
              day.isToday ? "bg-primary/10 ring-2 ring-primary" : "bg-card shadow-soft"
            )}
          >
            {/* Day Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-2xl font-serif font-bold",
                  day.isToday ? "text-primary" : "text-foreground"
                )}>
                  {format(day.date, "d")}
                </span>
                <div>
                  <span className={cn(
                    "text-sm font-sans font-medium",
                    day.isToday ? "text-primary" : "text-muted-foreground"
                  )}>
                    {format(day.date, "EEEE")}
                  </span>
                  {day.isToday && (
                    <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full font-sans font-medium">
                      Today
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-sans">
                {day.tasks.filter(t => t.completed).length}/{day.tasks.length} done
              </span>
            </div>

            {/* Tasks */}
            {day.tasks.length > 0 ? (
              <div className="space-y-2">
                {day.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl bg-background/50 transition-all",
                      task.completed && "opacity-60"
                    )}
                  >
                    <button
                      onClick={() => store.toggleTask(task.id)}
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        task.completed 
                          ? "bg-primary border-primary" 
                          : "border-muted-foreground/30 hover:border-primary"
                      )}
                    >
                      {task.completed && <Check className="w-3 h-3 text-primary-foreground" />}
                    </button>
                    <span className={cn(
                      "flex-1 font-sans text-sm",
                      task.completed && "line-through text-muted-foreground"
                    )}>
                      {task.title}
                    </span>
                    {task.time && (
                      <span className="text-xs text-muted-foreground font-sans">
                        {task.time}
                      </span>
                    )}
                    <ValueTag value={task.value as ValueType} size="sm" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground font-sans italic py-2">
                No tasks scheduled
              </p>
            )}
          </div>
        ))}
      </div>

      <BottomNav />
      <CoreAIFAB
        messages={coreAI.messages}
        onSendMessage={coreAI.sendMessage}
        onConfirmAction={coreAI.confirmAction}
        isLoading={coreAI.isLoading}
        aiName={store.settings.coreAIName}
        onClearHistory={coreAI.clearHistory}
        currentView="week"
      />
    </div>
  );
};

export default Week;