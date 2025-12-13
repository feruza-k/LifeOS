import { create } from "zustand";
import { api } from "@/lib/api";

export const useLifeOSStore = create((set, get) => ({
  // --- STATE ---
  today: null,
  tasks: [],
  reminders: [],
  note: null,
  checkIn: null,
  monthFocus: null,
  settings: {
    coreAIName: "SolAI",
  },

  // -------- LOADERS -------- //

  loadBootstrap: async () => {
    try {
      const data = await api.getBootstrap();
      set({
        today: data.today,
        tasks: data.today?.tasks || [],
        settings: { coreAIName: "SolAI" },
      });
      // Load reminders separately
      await get().loadReminders();
    } catch (error) {
      console.error("Failed to load bootstrap:", error);
      // Set empty state on error
      set({
        today: null,
        tasks: [],
        settings: { coreAIName: "SolAI" },
      });
    }
  },

  loadToday: async (date: Date | string) => {
    try {
      const d =
        typeof date === "string"
          ? date
          : date.toISOString().slice(0, 10);

      const res = await api.getToday(d);
      set({
        today: res,
        tasks: res.tasks || [],
      });
    } catch (error) {
      console.error("Failed to load today:", error);
      // Keep existing state on error
    }
  },

  // -------- TASK ACTIONS -------- //

  addTask: async (task) => {
    const created = await api.createTask(task);
    // Reload today to get fresh data from server
    await get().loadToday(task.date);
  },

  toggleTask: async (id: string) => {
    await api.completeTask(id);
    const currentDate = get().today?.date || new Date().toISOString().slice(0, 10);
    await get().loadToday(currentDate);
  },

  deleteTask: async (id: string) => {
    await api.deleteTask(id);
    const currentDate = get().today?.date || new Date().toISOString().slice(0, 10);
    await get().loadToday(currentDate);
  },

  moveTask: async (id: string, newDate: Date | string) => {
    const dateStr = typeof newDate === "string" 
      ? newDate 
      : newDate.toISOString().slice(0, 10);
    await api.moveTask(id, dateStr);
    await get().loadToday(dateStr);
  },

  getTasksForDate: async (date: string | Date) => {
    const d =
      typeof date === "string"
        ? date
        : date.toISOString().slice(0, 10);
    const tasks = await api.getTasksByDate(d);
    return tasks; // Returns array directly
  },

  // Synchronous getter for tasks by date (uses cached tasks)
  getTasksForDateSync: (date: string | Date) => {
    const d =
      typeof date === "string"
        ? date
        : date.toISOString().slice(0, 10);
    return get().tasks.filter(t => t.date === d);
  },

  // Load tasks for a date range (for calendar views)
  loadTasksForDateRange: async (start: Date | string, end: Date | string) => {
    try {
      const startStr = typeof start === "string" ? start : start.toISOString().slice(0, 10);
      const endStr = typeof end === "string" ? end : end.toISOString().slice(0, 10);
      const tasks = await api.getTasksByDateRange(startStr, endStr);
      // Merge with existing tasks (don't replace, as we might have tasks from today view)
      const existingTasks = get().tasks;
      const existingTaskIds = new Set(existingTasks.map(t => t.id));
      const newTasks = tasks.filter(t => !existingTaskIds.has(t.id));
      set({ tasks: [...existingTasks, ...newTasks] });
      return tasks;
    } catch (error) {
      console.error("Failed to load tasks for date range:", error);
      return [];
    }
  },

  // -------- REMINDERS -------- //

  loadReminders: async () => {
    try {
      const r = await api.getAllReminders();
      set({ reminders: r || [] });
    } catch (error) {
      console.error("Failed to load reminders:", error);
      set({ reminders: [] });
    }
  },

  addReminder: async (reminder) => {
    const created = await api.createReminder(reminder);
    set({ reminders: [...get().reminders, created] });
  },

  deleteReminder: async (id) => {
    await api.deleteReminder(id);
    set({
      reminders: get().reminders.filter((r) => r.id !== id),
    });
  },

  // -------- NOTES -------- //

  loadNote: async (date: string) => {
    try {
      const n = await api.getNote(date);
      set({ note: n });
      return n;
    } catch (error) {
      console.error("Failed to load note:", error);
      return null;
    }
  },

  getNoteForDate: (date: Date | string) => {
    // Synchronous getter - returns cached note if available
    // Note: This assumes note is loaded. For calendar, we'll load notes on demand.
    return get().note;
  },

  saveNote: async (date: Date | string, content: string) => {
    try {
      const dateStr = typeof date === "string" ? date : date.toISOString().slice(0, 10);
      const noteData = {
        date: dateStr,
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const saved = await api.saveNote(noteData);
      set({ note: saved });
      return saved;
    } catch (error) {
      console.error("Failed to save note:", error);
      throw error;
    }
  },

  // -------- CHECK-INS -------- //

  loadCheckIn: async (date: string) => {
    const c = await api.getCheckIn(date);
    set({ checkIn: c });
  },

  saveCheckIn: async (
    date: Date | string,
    completedIds: string[],
    incompleteIds: string[],
    movedTasks: { taskId: string; newDate: string }[],
    note?: string,
    mood?: string
  ) => {
    const dateStr = typeof date === "string" 
      ? date 
      : date.toISOString().slice(0, 10);
    await api.saveCheckIn({
      date: dateStr,
      completedTaskIds: completedIds,
      incompleteTaskIds: incompleteIds,
      movedTasks: movedTasks,
      note,
      mood,
    });
    await get().loadToday(dateStr);
  },

  // -------- MONTH FOCUS -------- //

  setCurrentMonthFocus: async (title: string, description?: string) => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const focus = await api.saveMonthlyFocus({
      month,
      title,
      description,
    });
    set({ monthFocus: focus });
  },

  // -------- CORE AI / CONVERSATIONS -------- //
  
  conversations: [],
  
  addMessage: (role: "user" | "assistant", content: string, actions?: any[]) => {
    const msg = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date().toISOString(),
      actions,
    };
    set({ conversations: [...get().conversations, msg] });
    return msg;
  },
  
  clearConversations: () => {
    set({ conversations: [] });
  },
}));
