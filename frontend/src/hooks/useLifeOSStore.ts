import { useLocalStorage } from "./useLocalStorage";
import { Task, DailyNote, CheckIn, Reminder, MonthlyFocus, UserSettings, ConversationMessage } from "@/types/lifeos";
import { format, parseISO, isToday, addDays } from "date-fns";

const defaultSettings: UserSettings = {
  checkInTime: "21:00",
  categories: ["health", "growth", "family", "work", "creativity"],
  coreAIName: "SolAI",
  theme: "system",
};

const initialTasks: Task[] = [
  // Today's tasks - Morning (before 12:00)
  { id: "1", title: "Morning meditation", time: "07:00", endTime: "07:30", completed: true, value: "health", date: format(new Date(), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  { id: "2", title: "Review quarterly goals", time: "09:00", endTime: "10:00", completed: false, value: "growth", date: format(new Date(), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  { id: "3", title: "Team standup call", time: "10:00", endTime: "10:30", completed: false, value: "work", date: format(new Date(), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  { id: "4", title: "Deep work session", time: "11:00", endTime: "12:00", completed: false, value: "work", date: format(new Date(), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  
  // Today's tasks - Afternoon (12:00 - 17:00)
  { id: "5", title: "Lunch with mentor", time: "12:30", endTime: "13:30", completed: false, value: "growth", date: format(new Date(), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  { id: "6", title: "Pick up kids", time: "15:30", endTime: "16:00", completed: false, value: "family", date: format(new Date(), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  
  // Today's tasks - Evening (after 17:00)
  { id: "7", title: "Evening workout", time: "18:00", endTime: "19:00", completed: false, value: "health", date: format(new Date(), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  { id: "8", title: "Family dinner", time: "19:00", endTime: "20:00", completed: false, value: "family", date: format(new Date(), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  { id: "9", title: "Creative writing", time: "20:00", endTime: "21:00", completed: false, value: "creativity", date: format(new Date(), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  
  // Tomorrow
  { id: "11", title: "Morning yoga", time: "06:30", endTime: "07:00", completed: false, value: "health", date: format(addDays(new Date(), 1), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  { id: "12", title: "Project presentation", time: "10:00", endTime: "11:00", completed: false, value: "work", date: format(addDays(new Date(), 1), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  { id: "13", title: "Doctor appointment", time: "14:00", endTime: "15:00", completed: false, value: "health", date: format(addDays(new Date(), 1), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  { id: "14", title: "Piano practice", time: "17:00", endTime: "18:00", completed: false, value: "creativity", date: format(addDays(new Date(), 1), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  
  // Day after tomorrow
  { id: "15", title: "Gym session", time: "07:00", endTime: "08:00", completed: false, value: "health", date: format(addDays(new Date(), 2), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  { id: "16", title: "Client meeting", time: "11:00", endTime: "12:00", completed: false, value: "work", date: format(addDays(new Date(), 2), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  { id: "17", title: "Family movie night", time: "19:00", endTime: "21:30", completed: false, value: "family", date: format(addDays(new Date(), 2), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  
  // More future tasks
  { id: "18", title: "Weekly review", time: "09:00", endTime: "10:00", completed: false, value: "growth", date: format(addDays(new Date(), 3), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  { id: "19", title: "Photography walk", time: "16:00", endTime: "18:00", completed: false, value: "creativity", date: format(addDays(new Date(), 3), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  { id: "20", title: "Cook new recipe", time: "18:00", endTime: "19:30", completed: false, value: "creativity", date: format(addDays(new Date(), 4), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  { id: "21", title: "Video call with parents", time: "20:00", endTime: "21:00", completed: false, value: "family", date: format(addDays(new Date(), 5), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
  { id: "22", title: "Sprint planning", time: "10:00", endTime: "11:30", completed: false, value: "work", date: format(addDays(new Date(), 6), "yyyy-MM-dd"), createdAt: new Date().toISOString() },
];

export function useLifeOSStore() {
  const [tasks, setTasks] = useLocalStorage<Task[]>("lifeos-tasks", initialTasks);
  const [notes, setNotes] = useLocalStorage<DailyNote[]>("lifeos-notes", []);
  const [checkIns, setCheckIns] = useLocalStorage<CheckIn[]>("lifeos-checkins", []);
  const [reminders, setReminders] = useLocalStorage<Reminder[]>("lifeos-reminders", []);
  const [monthlyFocus, setMonthlyFocus] = useLocalStorage<MonthlyFocus | null>("lifeos-monthly-focus", null);
  const [settings, setSettings] = useLocalStorage<UserSettings>("lifeos-settings", defaultSettings);
  const [conversations, setConversations] = useLocalStorage<ConversationMessage[]>("lifeos-conversations", []);

  // Task operations
  const getTasksForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return tasks.filter(t => t.date === dateStr);
  };

  const addTask = (task: Omit<Task, "id" | "createdAt">) => {
    const newTask: Task = {
      ...task,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    setTasks(prev => [...prev, newTask]);
    return newTask;
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const moveTask = (id: string, newDate: Date) => {
    const dateStr = format(newDate, "yyyy-MM-dd");
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, date: dateStr, movedFrom: t.date } : t
    ));
  };

  // Notes operations
  const getNoteForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return notes.find(n => n.date === dateStr);
  };

  const saveNote = (date: Date, content: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const existing = notes.find(n => n.date === dateStr);
    
    if (existing) {
      setNotes(prev => prev.map(n => 
        n.date === dateStr 
          ? { ...n, content, updatedAt: new Date().toISOString() }
          : n
      ));
    } else {
      const newNote: DailyNote = {
        id: Date.now().toString(),
        date: dateStr,
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setNotes(prev => [...prev, newNote]);
    }
  };

  // Check-in operations
  const getCheckInForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return checkIns.find(c => c.date === dateStr);
  };

  const saveCheckIn = (date: Date, completedIds: string[], incompleteIds: string[], movedTasks: { taskId: string; newDate: string }[], note?: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const checkIn: CheckIn = {
      id: Date.now().toString(),
      date: dateStr,
      completedTaskIds: completedIds,
      incompleteTaskIds: incompleteIds,
      movedTasks,
      note,
      timestamp: new Date().toISOString(),
    };
    setCheckIns(prev => [...prev.filter(c => c.date !== dateStr), checkIn]);
    
    // Also save the note if provided
    if (note) {
      saveNote(date, note);
    }
    
    return checkIn;
  };

  // Reminders
  const addReminder = (reminder: Omit<Reminder, "id" | "createdAt">) => {
    const newReminder: Reminder = {
      ...reminder,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    setReminders(prev => [...prev, newReminder]);
    return newReminder;
  };

  const deleteReminder = (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
  };

  // Monthly focus
  const getCurrentMonthFocus = () => {
    const currentMonth = format(new Date(), "yyyy-MM");
    if (monthlyFocus?.month === currentMonth) return monthlyFocus;
    return null;
  };

  const setCurrentMonthFocus = (title: string, description?: string) => {
    const focus: MonthlyFocus = {
      id: Date.now().toString(),
      month: format(new Date(), "yyyy-MM"),
      title,
      description,
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    setMonthlyFocus(focus);
  };

  // Conversation
  const addMessage = (role: "user" | "assistant", content: string, actions?: ConversationMessage["actions"]) => {
    const msg: ConversationMessage = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date().toISOString(),
      actions,
    };
    setConversations(prev => [...prev, msg]);
    return msg;
  };

  const clearConversations = () => setConversations([]);

  // Statistics
  const getStatistics = (startDate: Date, endDate: Date) => {
    const start = format(startDate, "yyyy-MM-dd");
    const end = format(endDate, "yyyy-MM-dd");
    
    const periodTasks = tasks.filter(t => t.date >= start && t.date <= end);
    const completed = periodTasks.filter(t => t.completed);
    const periodCheckIns = checkIns.filter(c => c.date >= start && c.date <= end);
    
    return {
      totalTasks: periodTasks.length,
      completedTasks: completed.length,
      completionRate: periodTasks.length ? Math.round((completed.length / periodTasks.length) * 100) : 0,
      checkInCount: periodCheckIns.length,
      categoryBreakdown: settings.categories.reduce((acc, cat) => {
        const catTasks = periodTasks.filter(t => t.value === cat);
        acc[cat] = {
          total: catTasks.length,
          completed: catTasks.filter(t => t.completed).length,
        };
        return acc;
      }, {} as Record<string, { total: number; completed: number }>),
    };
  };

  return {
    // Data
    tasks,
    notes,
    checkIns,
    reminders,
    monthlyFocus,
    settings,
    conversations,
    
    // Task operations
    getTasksForDate,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    moveTask,
    
    // Notes
    getNoteForDate,
    saveNote,
    
    // Check-ins
    getCheckInForDate,
    saveCheckIn,
    
    // Monthly focus
    getCurrentMonthFocus,
    setCurrentMonthFocus,
    
    // Reminders
    addReminder,
    deleteReminder,
    setReminders,
    
    // Settings
    setSettings,
    
    // Conversations
    addMessage,
    clearConversations,
    
    // Statistics
    getStatistics,
  };
}
