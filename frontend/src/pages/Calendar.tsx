import { useState, useEffect } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { LayoutGrid, Calendar as CalendarIcon } from "lucide-react";
import { BottomNav } from "@/components/lifeos/BottomNav";
import { CalendarFilters } from "@/components/lifeos/calendar/CalendarFilters";
import { MonthCalendar } from "@/components/lifeos/calendar/MonthCalendar";
import { WeekScheduleView } from "@/components/lifeos/calendar/WeekScheduleView";
import { DayModal } from "@/components/lifeos/calendar/DayModal";
import { Task } from "@/components/lifeos/TaskItem";
import { ValueType } from "@/components/lifeos/ValueTag";
import { CoreAIFAB } from "@/components/lifeos/CoreAI/CoreAIFAB";
import { useLifeOSStore } from "@/stores/useLifeOSStore";
import { useCoreAI } from "@/hooks/useCoreAI";
import { cn } from "@/lib/utils";
import { useSwipeable } from "react-swipeable";
import { api } from "@/lib/api";

type ViewMode = "month" | "week";

const CalendarPage = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showDayModal, setShowDayModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const store = useLifeOSStore();
  const coreAI = useCoreAI();
  const [selectedCategories, setSelectedCategories] = useState<ValueType[]>(
    (store.categories || []).map(c => c.id as ValueType)
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [checkIns, setCheckIns] = useState<Record<string, any>>({});

  // Load tasks for current month when month changes
  useEffect(() => {
    const loadMonthTasks = async () => {
      setLoading(true);
      try {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        await store.loadTasksForDateRange(monthStart, monthEnd);
      } catch (error) {
        console.error("Failed to load calendar tasks:", error);
      } finally {
        setLoading(false);
      }
    };
    loadMonthTasks();
  }, [currentMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load note and check-in when date is selected
  useEffect(() => {
    if (!selectedDate) return;
    
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    if (!notes[dateStr]) {
      store.loadNote(dateStr).then(note => {
        if (note) {
          setNotes(prev => ({ ...prev, [dateStr]: note.content || "" }));
        }
      }).catch(() => {
        // No note for this date, that's fine
      });
    }
    // Load check-in for this date
    if (!checkIns[dateStr]) {
      api.getCheckIn(dateStr).then(checkIn => {
        if (checkIn) {
          setCheckIns(prev => ({ ...prev, [dateStr]: checkIn }));
        }
      }).catch(() => {
        // No check-in for this date, that's fine
      });
    }
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Convert stored tasks to Task format with date
  const allTasks = store.tasks.map(t => ({
    id: t.id,
    title: t.title,
    time: t.time,
    endTime: t.endTime,
    completed: t.completed,
    value: t.value,
    date: t.date,
  }));

  const handleToggleCategory = (category: ValueType) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    );
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    if (viewMode === "month") {
      setShowDayModal(true);
    }
  };

  // Get tasks for selected date (use sync getter from cached tasks)
  const selectedDateTasks = selectedDate 
    ? store.getTasksForDateSync(selectedDate).map(t => ({
        id: t.id,
        title: t.title,
        time: t.time,
        endTime: t.endTime,
        completed: t.completed,
        value: t.value
      }))
    : [];

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const selectedDateCheckIn = dateStr ? checkIns[dateStr] : null;
  // Use saved note (excluding check-in note, which is shown separately)
  const selectedDateNote = dateStr ? (notes[dateStr] || "") : "";
  const completedCount = selectedDateTasks.filter(t => t.completed).length;
  const totalTasksCount = selectedDateTasks.length;

  // Swipe handlers for month navigation
  const monthSwipeHandlers = useSwipeable({
    onSwipedLeft: () => setCurrentMonth(addMonths(currentMonth, 1)),
    onSwipedRight: () => setCurrentMonth(subMonths(currentMonth, 1)),
    trackMouse: false,
    trackTouch: true,
  });

  return (
    <div className="min-h-screen bg-background pb-24 flex flex-col">
      {/* Top Brand */}
      <p className="text-xs font-sans font-medium text-muted-foreground tracking-widest uppercase text-center pt-3 pb-1">
        LifeOS, powered by SolAI
      </p>

      {/* Header with Month */}
      <header className="px-4 pb-2 animate-fade-in">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-xl font-sans font-bold text-foreground">
              {format(currentMonth, "MMM yyyy")}
            </h1>
            <p className="text-xs text-muted-foreground font-sans mt-0.5">
              Plan with intention
            </p>
          </div>
          
          {/* View Mode Toggle - Compact */}
          <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-lg">
            <button
              onClick={() => {
                setViewMode("month");
                setShowDayModal(false);
              }}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-md font-sans text-xs font-medium transition-all",
                viewMode === "month" 
                  ? "bg-card text-foreground shadow-sm" 
                  : "text-muted-foreground"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Month
            </button>
            <button
              onClick={() => {
                setViewMode("week");
                setShowDayModal(false);
              }}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-md font-sans text-xs font-medium transition-all",
                viewMode === "week" 
                  ? "bg-card text-foreground shadow-sm" 
                  : "text-muted-foreground"
              )}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Week
            </button>
          </div>
        </div>
      </header>

      {/* Calendar Container */}
      <div className="mx-4 bg-card rounded-2xl shadow-soft overflow-hidden animate-scale-in">
        {/* Category Filters - Inside the card */}
        <CalendarFilters 
          selectedCategories={selectedCategories} 
          onToggleCategory={handleToggleCategory} 
        />

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Calendar Views */}
        {!loading && viewMode === "month" && (
          <div {...monthSwipeHandlers} className="pb-4 flex-1">
            <MonthCalendar 
              currentMonth={currentMonth}
              selectedDate={selectedDate} 
              onSelectDate={handleSelectDate} 
              tasks={allTasks} 
              selectedCategories={selectedCategories}
              categories={store.categories || []}
            />
          </div>
        )}

        {!loading && viewMode === "week" && (
          <div className="py-2">
            <WeekScheduleView 
              selectedDate={selectedDate} 
              tasks={allTasks} 
              selectedCategories={selectedCategories}
              categories={store.categories || []}
              onToggleTask={async (id) => {
                await store.toggleTask(id);
                // Reload tasks for current month after toggle
                const monthStart = startOfMonth(currentMonth);
                const monthEnd = endOfMonth(currentMonth);
                await store.loadTasksForDateRange(monthStart, monthEnd);
              }}
              onWeekChange={async (date) => {
                setSelectedDate(date);
                // Load tasks for the week when week changes
                const weekStart = startOfMonth(date);
                const weekEnd = endOfMonth(date);
                await store.loadTasksForDateRange(weekStart, weekEnd);
              }}
            />
          </div>
        )}
      </div>

      {/* Day Modal - Centered */}
      {showDayModal && viewMode === "month" && selectedDate && (
        <DayModal
          date={selectedDate}
          tasks={selectedDateTasks}
          note={selectedDateNote || ""}
          checkIn={selectedDateCheckIn}
          completedCount={completedCount}
          totalTasksCount={totalTasksCount}
          onClose={() => setShowDayModal(false)}
          onToggleTask={async (id) => {
            await store.toggleTask(id);
            // Reload tasks for current month after toggle
            const monthStart = startOfMonth(currentMonth);
            const monthEnd = endOfMonth(currentMonth);
            await store.loadTasksForDateRange(monthStart, monthEnd);
          }}
          onSaveNote={async (content) => {
            await store.saveNote(selectedDate, content);
            const dateStr = format(selectedDate, "yyyy-MM-dd");
            setNotes(prev => ({ ...prev, [dateStr]: content }));
          }}
        />
      )}

      <BottomNav />
      <CoreAIFAB 
        messages={coreAI.messages} 
        onSendMessage={coreAI.sendMessage} 
        isLoading={coreAI.isLoading} 
        aiName={store.settings.coreAIName} 
      />
    </div>
  );
};

export default CalendarPage;