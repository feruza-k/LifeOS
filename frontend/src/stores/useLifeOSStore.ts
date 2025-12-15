import { create } from "zustand";
import { api } from "@/lib/api";
import { Category } from "@/types/lifeos";

interface LifeOSStore {
  // State
  today: any;
  tasks: any[];
  reminders: any[];
  note: any;
  checkIn: any;
  monthFocus: any;
  settings: {
    coreAIName: string;
  };
  categories: Category[];
  conversations: any[];
  
  // Methods
  loadBootstrap: () => Promise<void>;
  loadToday: (date: Date | string) => Promise<void>;
  addTask: (task: any) => Promise<void>;
  updateTask: (id: string, updates: any) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  moveTask: (id: string, newDate: Date | string) => Promise<void>;
  getTasksForDate: (date: string | Date) => Promise<any[]>;
  getTasksForDateSync: (date: string | Date) => any[];
  loadTasksForDateRange: (start: Date | string, end: Date | string) => Promise<any[]>;
  loadReminders: () => Promise<void>;
  addReminder: (reminder: any) => Promise<void>;
  updateReminder: (id: string, updates: any) => Promise<any>;
  deleteReminder: (id: string) => Promise<void>;
  loadNote: (date: string) => Promise<any>;
  getNoteForDate: (date: Date | string) => any;
  saveNote: (noteData: { date: string; content: string; photo?: { filename: string; uploadedAt: string } | null } | Date | string, content?: string) => Promise<any>;
  loadCheckIn: (date: string) => Promise<void>;
  saveCheckIn: (
    date: Date | string,
    completedIds: string[],
    incompleteIds: string[],
    movedTasks: { taskId: string; newDate: string }[],
    note?: string,
    mood?: string
  ) => Promise<void>;
  setCurrentMonthFocus: (title: string, description?: string) => Promise<void>;
  addMessage: (role: "user" | "assistant", content: string, actions?: any[]) => any;
  clearConversations: () => void;
  // Category management
  loadCategories: () => Promise<void>;
  addCategory: (label: string, color: string) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Omit<Category, 'id'>>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useLifeOSStore = create<LifeOSStore>()((set, get) => ({
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
  categories: [
    { id: "health", label: "Health", color: "#C7DED5" }, // Muted Sage
    { id: "growth", label: "Growth", color: "#C9DCEB" }, // Pale Sky
    { id: "family", label: "Family", color: "#F4D6E4" }, // Dusty Rose
    { id: "work", label: "Work", color: "#DCD0E6" }, // Lavender Mist
    { id: "creativity", label: "Creativity", color: "#FFF5E0" }, // Creamy Yellow
  ],

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
      // Load categories
      await get().loadCategories();
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

  updateTask: async (id: string, updates: any) => {
    await api.updateTask(id, updates);
    // Reload tasks for the date
    const taskDate = updates.date || get().today?.date || new Date().toISOString().slice(0, 10);
    await get().loadToday(taskDate);
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
    return created;
  },

  updateReminder: async (id: string, updates: any) => {
    try {
      const updated = await api.updateReminder(id, updates);
      if (updated) {
        set({
          reminders: get().reminders.map((r) => (r.id === id ? updated : r)),
        });
        return updated;
      }
    } catch (error) {
      console.error("Failed to update reminder:", error);
    }
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

  saveNote: async (noteDataOrDate: { date: string; content: string; photo?: { filename: string; uploadedAt: string } | null } | Date | string, content?: string) => {
    try {
      let noteData: { date: string; content: string; photo?: { filename: string; uploadedAt: string } | null };
      
      // Handle both old signature (date, content) and new signature (noteData object)
      if (typeof noteDataOrDate === "object" && "date" in noteDataOrDate) {
        noteData = noteDataOrDate;
      } else {
        const dateStr = typeof noteDataOrDate === "string" ? noteDataOrDate : noteDataOrDate.toISOString().slice(0, 10);
        noteData = {
          date: dateStr,
          content: content || "",
        };
      }
      
      const saved = await api.saveNote({
        ...noteData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
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

  // -------- CATEGORIES -------- //

  loadCategories: async () => {
    try {
      const categories = await api.getAllCategories();
      if (categories && Array.isArray(categories)) {
        set({ categories });
      }
    } catch (error) {
      console.error("Failed to load categories:", error);
      // Keep existing categories on error
    }
  },

  addCategory: async (label: string, color: string) => {
    try {
      const newCategory = await api.createCategory({ label, color });
      set({ categories: [...get().categories, newCategory] });
    } catch (error) {
      console.error("Failed to add category:", error);
      throw error;
    }
  },

  updateCategory: async (id: string, updates: Partial<Omit<Category, 'id'>>) => {
    try {
      const updated = await api.updateCategory(id, updates);
      if (updated) {
        set({
          categories: get().categories.map((c) => (c.id === id ? updated : c)),
        });
      }
    } catch (error) {
      console.error("Failed to update category:", error);
      throw error;
    }
  },

  deleteCategory: async (id: string) => {
    try {
      await api.deleteCategory(id);
      set({
        categories: get().categories.filter((c) => c.id !== id),
      });
    } catch (error) {
      console.error("Failed to delete category:", error);
      throw error;
    }
  },
}));
