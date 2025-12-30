import { useState, useEffect, useMemo } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, addDays, subDays, isSameMonth } from "date-fns";
import { normalizeDate } from "@/utils/dateUtils";
import { LayoutGrid, Calendar as CalendarIcon } from "lucide-react";
import { BottomNav } from "@/components/lifeos/BottomNav";
import { QuickMenu } from "@/components/lifeos/QuickMenu";
import { CalendarFilters } from "@/components/lifeos/calendar/CalendarFilters";
import { MonthCalendar } from "@/components/lifeos/calendar/MonthCalendar";
import { WeekScheduleView } from "@/components/lifeos/calendar/WeekScheduleView";
import { DayModal } from "@/components/lifeos/calendar/DayModal";
import { AddTaskModal } from "@/components/lifeos/AddTaskModal";
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
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const store = useLifeOSStore();
  const coreAI = useCoreAI();
  const [selectedCategories, setSelectedCategories] = useState<ValueType[]>(
    (store.categories || []).map(c => c.id as ValueType)
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, { filename: string; uploadedAt: string } | null>>({});
  const [checkIns, setCheckIns] = useState<Record<string, any>>({});

  // Load categories on mount
  useEffect(() => {
    store.loadCategories();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync selectedCategories when categories change
  useEffect(() => {
    if (store.categories && store.categories.length > 0) {
      const categoryIds = store.categories.map(c => c.id as ValueType);
      // Only update if the current selection includes categories that no longer exist
      const validSelected = selectedCategories.filter(id => categoryIds.includes(id));
      if (validSelected.length !== selectedCategories.length) {
        setSelectedCategories(categoryIds);
      }
    }
  }, [store.categories]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load tasks for current month when month changes
  useEffect(() => {
    const loadMonthTasks = async () => {
      setLoading(true);
      try {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        await store.loadTasksForDateRange(monthStart, monthEnd);
      } catch (error) {
        // Error loading tasks - silently fail
      } finally {
        setLoading(false);
      }
    };
    loadMonthTasks();
  }, [currentMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load note, photos, and check-in when date is selected
  useEffect(() => {
    if (!selectedDate) return;
    
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    if (!notes[dateStr]) {
      store.loadNote(dateStr).then(note => {
        if (note) {
          setNotes(prev => ({ ...prev, [dateStr]: note?.content || "" }));
          try {
            if (note && note.photo && typeof note.photo === 'object' && note.photo.filename) {
              setPhotos(prev => ({ ...prev, [dateStr]: note.photo }));
            } else if (note && note.photos && Array.isArray(note.photos) && note.photos.length > 0) {
              // Migrate from old photos array to single photo (take first photo)
              setPhotos(prev => ({ ...prev, [dateStr]: note.photos[0] }));
            } else {
              setPhotos(prev => ({ ...prev, [dateStr]: null }));
            }
          } catch (error) {
            setPhotos(prev => ({ ...prev, [dateStr]: null }));
          }
        }
      }).catch(() => {
      });
    } else {
      // If note exists but photo doesn't, initialize photo
      if (!(dateStr in photos)) {
        setPhotos(prev => ({ ...prev, [dateStr]: null }));
      }
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

  // Normalize tasks to ensure dates are in YYYY-MM-DD format
  const allTasks = useMemo(() => {
    const normalized = store.tasks
      .filter(t => t && t.id && t.date) // Filter out invalid tasks and tasks without dates
      .map(t => {
        const taskDate = normalizeDate(t.date);
        if (!taskDate) return null;
        
        return {
          id: t.id,
          title: t.title || '',
          time: t.time || undefined,
          endTime: t.endTime || undefined,
          completed: t.completed || false,
          value: t.value,
          date: taskDate,
        };
      })
      .filter(t => t && t.date && t.date.length === 10);
    
    return normalized;
  }, [store.tasks]);

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
      <header className="px-4 pb-2 pt-4 animate-fade-in">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-sans font-bold text-foreground">
            {format(currentMonth, "MMM yyyy")}
          </h1>
          
          <div className="flex items-center gap-2">
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
          <QuickMenu />
          </div>
        </div>
      </header>

      {/* Calendar Container */}
      <div className="mx-1 bg-card rounded-2xl shadow-soft overflow-hidden animate-scale-in">
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
              onUpdateTask={async (id, updates) => {
                await store.updateTask(id, updates);
                // Reload tasks for current month
                const monthStart = startOfMonth(currentMonth);
                const monthEnd = endOfMonth(currentMonth);
                await store.loadTasksForDateRange(monthStart, monthEnd);
              }}
              onDeleteTask={async (id) => {
                await store.deleteTask(id);
                // Reload tasks for current month
                const monthStart = startOfMonth(currentMonth);
                const monthEnd = endOfMonth(currentMonth);
                await store.loadTasksForDateRange(monthStart, monthEnd);
              }}
                  onAddTask={async (taskData) => {
                    const result = await store.addTask({
                      title: taskData.title,
                      time: taskData.time,
                      endTime: taskData.endTime,
                      value: taskData.value,
                      date: taskData.date,
                      completed: false,
                    });
                    // If conflict, the modal will handle it - don't reload
                    if (result && typeof result === 'object' && 'conflict' in result && result.conflict === true) {
                      return; // Let AddTaskModal handle the conflict dialog
                    }
                    
                    // Reload tasks for the relevant month
                    const taskDateObj = parseISO(taskData.date);
                    const monthStart = startOfMonth(taskDateObj);
                    const monthEnd = endOfMonth(taskDateObj);
                    await store.loadTasksForDateRange(monthStart, monthEnd);
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
          onDeleteTask={async (id) => {
            await store.deleteTask(id);
            // Reload tasks for current month after delete
            const monthStart = startOfMonth(currentMonth);
            const monthEnd = endOfMonth(currentMonth);
            await store.loadTasksForDateRange(monthStart, monthEnd);
          }}
          onUpdateTask={async (id, updates) => {
            await store.updateTask(id, updates);
            // Reload tasks for current month after update
            const monthStart = startOfMonth(currentMonth);
            const monthEnd = endOfMonth(currentMonth);
            await store.loadTasksForDateRange(monthStart, monthEnd);
          }}
          photo={selectedDate ? (photos[format(selectedDate, "yyyy-MM-dd")] ?? null) : null}
          onPhotoChange={async (updatedPhoto) => {
            if (!selectedDate) return;
            const dateStr = format(selectedDate, "yyyy-MM-dd");
            setPhotos(prev => ({ ...prev, [dateStr]: updatedPhoto }));
            
            // Update note with photo
            const currentNote = notes[dateStr] || "";
            await store.saveNote({
              date: dateStr,
              content: currentNote,
              photo: updatedPhoto,
            });
          }}
          onSaveNote={async (content) => {
            const dateStr = format(selectedDate, "yyyy-MM-dd");
            const currentPhoto = photos[dateStr] || null;
            await store.saveNote({
              date: dateStr,
              content: content,
              photo: currentPhoto,
            });
            setNotes(prev => ({ ...prev, [dateStr]: content }));
          }}
          onUpdateCheckIn={async (updates) => {
            if (!selectedDate) return;
            const dateStr = format(selectedDate, "yyyy-MM-dd");
            const currentCheckIn = checkIns[dateStr] || {};
            const updatedCheckIn = {
              ...currentCheckIn,
              date: dateStr,
              ...updates,
            };
            try {
              await api.saveCheckIn(updatedCheckIn);
              setCheckIns(prev => ({ ...prev, [dateStr]: updatedCheckIn }));
            } catch (error) {
              console.error("Failed to update check-in:", error);
            }
          }}
          onDateChange={async (newDate) => {
            setSelectedDate(newDate);
            // Load note and check-in for new date
            const dateStr = format(newDate, "yyyy-MM-dd");
            if (!notes[dateStr]) {
              store.loadNote(dateStr).then(note => {
                  if (note) {
                  setNotes(prev => ({ ...prev, [dateStr]: note?.content || "" }));
                  try {
                    if (note && note.photo && typeof note.photo === 'object' && note.photo.filename) {
                      setPhotos(prev => ({ ...prev, [dateStr]: note.photo }));
                    } else if (note && note.photos && Array.isArray(note.photos) && note.photos.length > 0) {
                      // Migrate from old photos array to single photo (take first photo)
                      setPhotos(prev => ({ ...prev, [dateStr]: note.photos[0] }));
                    } else {
                      setPhotos(prev => ({ ...prev, [dateStr]: null }));
                    }
                  } catch (error) {
                    setPhotos(prev => ({ ...prev, [dateStr]: null }));
                  }
                }
              }).catch(() => {
              });
            } else {
              // If note exists but photo doesn't, initialize photo
              if (!(dateStr in photos)) {
                setPhotos(prev => ({ ...prev, [dateStr]: null }));
              }
            }
            if (!checkIns[dateStr]) {
              api.getCheckIn(dateStr).then(checkIn => {
                if (checkIn) {
                  setCheckIns(prev => ({ ...prev, [dateStr]: checkIn }));
                }
              }).catch(() => {});
            }
            // Reload tasks for the month if needed
            if (!isSameMonth(newDate, currentMonth)) {
              setCurrentMonth(startOfMonth(newDate));
            }
          }}
          onAddTask={(date) => {
            setSelectedDate(date);
            setShowAddTaskModal(true);
          }}
        />
      )}

      {/* Add Task Modal */}
      {showAddTaskModal && selectedDate && (
        <AddTaskModal
          isOpen={showAddTaskModal}
          onClose={() => setShowAddTaskModal(false)}
          date={format(selectedDate, "yyyy-MM-dd")}
          onAdd={async (taskData) => {
            const result = await store.addTask({
              title: taskData.title,
              time: taskData.time,
              endTime: taskData.endTime,
              value: taskData.value,
              date: taskData.date,
              completed: false,
              repeat: taskData.repeat,
            });
            // If conflict, the modal will handle it - don't close modal, don't reload
            if (result && typeof result === 'object' && 'conflict' in result && result.conflict === true) {
              return result; // Return conflict so AddTaskModal knows to keep modal open
            }
            
            // Success - clear everything and reload the month
            setShowAddTaskModal(false);
            
            // Reload tasks for current month to ensure new task appears
            // We use the task's date to determine which month to refresh if it's different
            const taskDateObj = parseISO(taskData.date);
            const refreshMonth = isSameMonth(taskDateObj, currentMonth) ? currentMonth : taskDateObj;
            
            const monthStart = startOfMonth(refreshMonth);
            const monthEnd = endOfMonth(refreshMonth);
            await store.loadTasksForDateRange(monthStart, monthEnd);
            
            // If we moved to a new month, update the view
            if (!isSameMonth(taskDateObj, currentMonth)) {
              setCurrentMonth(startOfMonth(taskDateObj));
            }
            
            return result;
          }}
        />
      )}

      <BottomNav />
      <CoreAIFAB 
        messages={coreAI.messages} 
        onSendMessage={coreAI.sendMessage}
        onConfirmAction={coreAI.confirmAction}
        isLoading={coreAI.isLoading} 
        aiName={store.settings.coreAIName}
        onClearHistory={coreAI.clearHistory}
        currentView="calendar"
        selectedDate={selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined}
      />
    </div>
  );
};

export default CalendarPage;