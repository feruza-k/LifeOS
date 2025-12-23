import { useState, useEffect } from "react";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { Task } from "@/components/lifeos/TaskItem";
import { ValueType } from "@/components/lifeos/ValueTag";
import { Category } from "@/types/lifeos";
import { cn } from "@/lib/utils";
import { useSwipeable } from "react-swipeable";
import { AddTaskModal } from "../AddTaskModal";

interface CalendarTask extends Task {
  date?: string;
}

interface WeekScheduleViewProps {
  selectedDate: Date;
  tasks: CalendarTask[];
  selectedCategories: ValueType[];
  onToggleTask: (id: string) => void;
  onWeekChange: (date: Date) => void;
  categories: Category[];
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onDeleteTask?: (id: string) => void;
  onAddTask?: (task: { title: string; time?: string; endTime?: string; value: ValueType; date: string }) => Promise<any>;
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM to 9 PM
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeekScheduleView({
  selectedDate,
  tasks,
  selectedCategories,
  onToggleTask,
  onWeekChange,
  categories,
  onUpdateTask,
  onDeleteTask,
  onAddTask,
}: WeekScheduleViewProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [quickAddTime, setQuickAddTime] = useState<{ date: string; time: string } | null>(null);
  const [lastTap, setLastTap] = useState<{ taskId: string; time: number } | null>(null);
  const [tapTimeout, setTapTimeout] = useState<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeout) {
        clearTimeout(tapTimeout);
      }
    };
  }, [tapTimeout]);

  // Get category color by id
  const getCategoryColor = (categoryId: string): string => {
    if (!categoryId) {
      return "#EBEBEB";
    }
    
    let category = categories.find(c => c.id === categoryId);
    
    if (!category) {
      category = categories.find(c => c.label.toLowerCase() === categoryId.toLowerCase());
    }
    
    return category?.color || "#EBEBEB";
  };

  // Convert hex color to rgba with opacity
  const hexToRgba = (hex: string, opacity: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      date,
      dayName: DAYS[i],
      dayNum: format(date, "d"),
      fullDate: format(date, "yyyy-MM-dd"),
      isToday: format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"),
    };
  });

  // Get task position and height based on time and duration
  const getTaskStyle = (time: string, duration: number = 60) => {
    const [hours, minutes] = time.split(":").map(Number);
    const startHour = hours - 6; // Offset from 6 AM
    const topPercent = ((startHour * 60 + minutes) / (16 * 60)) * 100;
    const heightPercent = (duration / (16 * 60)) * 100;
    return {
      top: `${topPercent}%`,
      height: `${Math.max(heightPercent, 3)}%`,
    };
  };

  // Calculate time from click position in hour block
  const getTimeFromClick = (hour: number, clickY: number, blockHeight: number): string => {
    const hourStart = hour - 6;
    const percentInHour = (clickY / blockHeight);
    const minutes = Math.round(percentInHour * 60);
    const totalMinutes = hourStart * 60 + minutes;
    const finalHour = Math.floor(totalMinutes / 60) + 6;
    const finalMins = totalMinutes % 60;
    return `${finalHour.toString().padStart(2, "0")}:${finalMins.toString().padStart(2, "0")}`;
  };

  // Calculate end time (1 hour after start)
  const calculateEndTime = (startTime: string): string => {
    const [hours, minutes] = startTime.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + 60;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMins = totalMinutes % 60;
    return `${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`;
  };

  // Get tasks for a specific date (Week View = Scheduled Tasks Only)
  const getTasksForDate = (dateStr: string) => {
    // Normalize date string for comparison
    const normalizedDateStr = dateStr.length > 10 ? dateStr.substring(0, 10) : dateStr;
    
    const allTasks = tasks.filter(
      (task) => {
        // Must have date and time (scheduled tasks only)
        if (!task.date || !task.time) return false;
        
        // Normalize task date for comparison
        let taskDate = task.date;
        if (typeof taskDate === 'string') {
          if (taskDate.includes('T')) taskDate = taskDate.split('T')[0];
          if (taskDate.includes(' ')) taskDate = taskDate.split(' ')[0];
          if (taskDate.length > 10) taskDate = taskDate.substring(0, 10);
        } else if (taskDate instanceof Date) {
          taskDate = taskDate.toISOString().slice(0, 10);
        }
        
        // Date must match
        if (taskDate !== normalizedDateStr) return false;
        
        // Category matching logic (same as month view):
        // - If no categories selected OR all categories selected, show all tasks
        // - Otherwise, show tasks that match selected categories OR tasks without a value
        const allCategoryIds = categories.map(c => c.id);
        const allSelected = selectedCategories.length === 0 || 
                           (selectedCategories.length === allCategoryIds.length && 
                            allCategoryIds.every(id => selectedCategories.includes(id)));
        
        if (allSelected) {
          return true; // All categories selected = no filter, show all
        }
        
        // If task has a value, check if it matches selected categories
        if (task.value) {
          return selectedCategories.includes(task.value);
        }
        
        // If task has no value, show it anyway (legacy task or uncategorized)
        return true;
      }
    );
    
    // Only scheduled tasks - sorted by time
    const scheduled = allTasks.sort((a, b) => {
      if (!a.time || !b.time) return 0;
      return a.time.localeCompare(b.time);
    });
    
    return { scheduled, anytime: [] };
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => onWeekChange(addWeeks(selectedDate, 1)),
    onSwipedRight: () => onWeekChange(subWeeks(selectedDate, 1)),
    trackMouse: false,
    trackTouch: true,
  });

  return (
    <div {...handlers} className="px-2 animate-slide-up">
      {/* Week Header */}
      <div className="grid grid-cols-[3rem_repeat(7,1fr)] gap-0.5 mb-1">
        <div className="text-[10px] text-muted-foreground font-sans text-center py-1"></div>
        {weekDays.map((day, i) => (
          <div
            key={i}
            className={cn(
              "text-center py-1",
              day.isToday && "bg-primary/10 rounded-lg"
            )}
          >
            <div className={cn(
              "text-[10px] font-sans font-medium",
              day.isToday ? "text-primary" : "text-muted-foreground"
            )}>
              {day.dayName}
            </div>
            <div className={cn(
              "text-sm font-sans font-bold",
              day.isToday ? "text-primary" : "text-foreground"
            )}>
              {day.dayNum}
            </div>
          </div>
        ))}
      </div>

      {/* Schedule Grid */}
      <div className="relative bg-card border border-border/50 overflow-hidden">
        <div className="grid grid-cols-[3rem_repeat(7,1fr)] gap-0.5">
          {/* Time Column */}
          <div className="border-r border-border/30">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-10 flex items-start justify-end pr-0.5 pt-0.5"
              >
                <span className="text-[9px] text-muted-foreground font-sans">
                  {hour}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {weekDays.map((day, dayIndex) => {
            const { scheduled, anytime } = getTasksForDate(day.fullDate);
            
            // Calculate duration from time and endTime
            const getDuration = (task: Task) => {
              if (!task.time || !task.endTime) return 60;
              const [startH, startM] = task.time.split(":").map(Number);
              const [endH, endM] = task.endTime.split(":").map(Number);
              const startMinutes = startH * 60 + startM;
              const endMinutes = endH * 60 + endM;
              return endMinutes - startMinutes;
            };
            
            return (
              <div
                key={day.fullDate}
                className={cn(
                  "relative border-r border-border/20 last:border-r-0",
                  day.isToday && "border-l-2 border-l-primary/30"
                )}
              >
                {/* Hour lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="h-10 border-b border-border/10 pointer-events-none"
                  />
                ))}

                {/* Clickable backdrop for adding tasks on empty blocks */}
                {onAddTask && (
                  <div
                    className="absolute inset-0 z-0 cursor-pointer"
                    onClick={(e) => {
                      // Don't trigger if clicking on a task
                      const target = e.target as HTMLElement;
                      if (target.closest('[data-task-block]')) {
                        return;
                      }
                      
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickY = e.clientY - rect.top;
                      const clickPercent = (clickY / rect.height) * 100;
                      const totalMinutes = (clickPercent / 100) * (16 * 60);
                      const hour = Math.floor(totalMinutes / 60) + 6;
                      const minutes = Math.round(totalMinutes % 60);
                      
                      // Snap to nearest 15-minute interval for better UX
                      const snappedMinutes = Math.round(minutes / 15) * 15;
                      const finalHour = hour + Math.floor(snappedMinutes / 60);
                      const finalMins = snappedMinutes % 60;
                      
                      const time = `${finalHour.toString().padStart(2, "0")}:${finalMins.toString().padStart(2, "0")}`;
                      
                      setQuickAddTime({ date: day.fullDate, time });
                    }}
                    onMouseEnter={(e) => {
                      const target = e.currentTarget;
                      target.classList.add('hover:bg-primary/5');
                    }}
                  />
                )}

                {/* Scheduled Tasks */}
                <div className="absolute inset-0 z-10 pointer-events-none">
                  {scheduled.map((task) => {
                    const duration = getDuration(task);
                    const style = getTaskStyle(task.time!, duration);
                    const categoryColor = getCategoryColor(task.value || "");
                    return (
                      <button
                        key={task.id}
                        data-task-block
                        onClick={(e) => {
                          e.stopPropagation();
                          const now = Date.now();
                          
                          // Clear any existing timeout
                          if (tapTimeout) {
                            clearTimeout(tapTimeout);
                            setTapTimeout(null);
                          }
                          
                          // Check for double tap (within 250ms)
                          if (lastTap && lastTap.taskId === task.id && now - lastTap.time < 250) {
                            // Double tap - toggle completion
                            onToggleTask(task.id);
                            setLastTap(null);
                            setTapTimeout(null);
                          } else {
                            // Single tap - set timer to open edit modal
                            setLastTap({ taskId: task.id, time: now });
                            const timeout = setTimeout(() => {
                              // Only open if this is still the last tap
                              setLastTap((prev) => {
                                if (prev && prev.taskId === task.id) {
                                  setEditingTask(task);
                                  return null;
                                }
                                return prev;
                              });
                              setTapTimeout(null);
                            }, 250);
                            setTapTimeout(timeout);
                          }
                        }}
                        style={{ 
                          top: style.top, 
                          height: style.height,
                          backgroundColor: hexToRgba(categoryColor, 0.6),
                          borderLeft: `4px solid ${categoryColor}`,
                        }}
                        className={cn(
                          "absolute left-0.5 right-0.5 rounded px-1 py-1 overflow-hidden transition-all duration-300 flex items-start text-left",
                          "hover:opacity-90 active:scale-[0.98] pointer-events-auto",
                          task.completed ? "opacity-35" : "opacity-85"
                        )}
                      >
                        <p className={cn(
                          "text-[9px] font-sans font-medium text-foreground leading-tight break-words",
                          task.completed && "line-through opacity-70",
                          "line-clamp-3"
                        )}>
                          {task.title}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-center text-[10px] text-muted-foreground/60 font-sans mt-2">
        Swipe left/right to change week
      </p>

      {/* AddTaskModal for editing */}
      {editingTask && onUpdateTask && (
        <AddTaskModal
          isOpen={!!editingTask}
          onClose={() => {
            setEditingTask(null);
            // Clear any pending tap timeout when closing
            if (tapTimeout) {
              clearTimeout(tapTimeout);
              setTapTimeout(null);
            }
            setLastTap(null);
          }}
          task={editingTask}
          date={editingTask.date || format(selectedDate, "yyyy-MM-dd")}
          onUpdate={onUpdateTask}
          onDelete={onDeleteTask}
          onAdd={() => {}} // Not used when editing
        />
      )}

      {/* AddTaskModal for adding */}
      {quickAddTime && onAddTask && (
        <AddTaskModal
          isOpen={!!quickAddTime}
          onClose={() => {
            setQuickAddTime(null);
          }}
          date={quickAddTime.date}
          initialTime={quickAddTime.time}
          onAdd={async (newTask) => {
            if (onAddTask) {
              const result = await onAddTask({
              title: newTask.title,
              time: newTask.time,
              endTime: newTask.endTime,
              value: newTask.value,
              date: newTask.date,
            });
              // If conflict, the modal will handle it - don't close
              if (result && typeof result === 'object' && 'conflict' in result && result.conflict === true) {
                return result; // Return conflict to AddTaskModal
              }
            }
            setQuickAddTime(null);
          }}
        />
      )}
    </div>
  );
}