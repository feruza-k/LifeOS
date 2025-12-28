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
  chatHistory: Array<{ id: string; title: string; messages: any[]; date: string }>;
  
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
  addMessage: (role: "user" | "assistant", content: string, ui?: any) => any;
  clearConversations: () => void;
  saveChatToHistory: (title: string) => void;
  loadChatFromHistory: (chatId: string) => void;
  deleteChatFromHistory: (chatId: string) => void;
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
      const todayTasks = res.tasks || [];
      
      set((state) => {
        // Merge today's tasks with existing tasks (update existing, add new)
        const existingTaskMap = new Map(state.tasks.map(t => [t.id, t]));
        
        // Update or add today's tasks
        todayTasks.forEach(task => {
          existingTaskMap.set(task.id, task);
        });
        
        return {
          today: res,
          tasks: Array.from(existingTaskMap.values()),
        };
      });
    } catch (error) {
      // Keep existing state on error
    }
  },

  // -------- TASK ACTIONS -------- //

  addTask: async (task) => {
    try {
      const response = await api.createTask(task);
      
      // Check if backend returned a conflict response
      if (response && response.conflict === true) {
        return response;
      }
      
      // Normal task creation - ensure date is in YYYY-MM-DD format
      const created = response;
      if (created) {
        if (!created.date && task.date) {
          created.date = typeof task.date === 'string' ? task.date : task.date.toISOString().slice(0, 10);
        }
        if (created.date && created.date.includes('T')) {
          created.date = created.date.split('T')[0];
        }
      }
      
      set((state) => {
        const existingTasks = state.tasks;
        const taskExists = existingTasks.some(t => t.id === created.id);
        const updatedTasks = taskExists 
          ? existingTasks.map(t => t.id === created.id ? created : t)
          : [...existingTasks, created];
          
        return { tasks: updatedTasks };
      });

      // Reload today to get fresh data from server
      await get().loadToday(task.date);
      return created;
    } catch (error) {
      throw error;
    }
  },

  updateTask: async (id: string, updates: any) => {
    const updated = await api.updateTask(id, updates);
    if (updated) {
      set((state) => ({
        tasks: state.tasks.map(t => t.id === id ? updated : t)
      }));
    }
    const taskDate = updates.date || get().today?.date || new Date().toISOString().slice(0, 10);
    await get().loadToday(taskDate);
  },

  toggleTask: async (id: string) => {
    const response = await api.completeTask(id);
    if (response && response.task) {
      set((state) => ({
        tasks: state.tasks.map(t => t.id === id ? response.task : t)
      }));
    }
    const currentDate = get().today?.date || new Date().toISOString().slice(0, 10);
    await get().loadToday(currentDate);
  },

  deleteTask: async (id: string) => {
    await api.deleteTask(id);
    set((state) => ({
      tasks: state.tasks.filter(t => t.id !== id)
    }));
    const currentDate = get().today?.date || new Date().toISOString().slice(0, 10);
    await get().loadToday(currentDate);
  },

  moveTask: async (id: string, newDate: Date | string) => {
    const dateStr = typeof newDate === "string" 
      ? newDate 
      : newDate.toISOString().slice(0, 10);
    const updated = await api.moveTask(id, dateStr);
    if (updated) {
      set((state) => ({
        tasks: state.tasks.map(t => t.id === id ? updated : t)
      }));
    }
    await get().loadToday(dateStr);
  },

  getTasksForDate: async (date: string | Date) => {
    const d =
      typeof date === "string"
        ? date
        : date.toISOString().slice(0, 10);
    const tasks = await api.getTasksByDate(d);
    return tasks;
  },

  // Synchronous getter for tasks by date (uses cached tasks)
  getTasksForDateSync: (date: string | Date) => {
    const d =
      typeof date === "string"
        ? date
        : date.toISOString().slice(0, 10);
    
    return get().tasks.filter(t => {
      if (!t.date) return false;
      // Normalize task date for comparison
      const taskDate = typeof t.date === 'string' && t.date.includes('T') 
        ? t.date.split('T')[0] 
        : t.date;
      return taskDate === d;
    });
  },

  // Load tasks for a date range (for calendar views)
  loadTasksForDateRange: async (start: Date | string, end: Date | string) => {
    try {
      const startStr = typeof start === "string" ? start : start.toISOString().slice(0, 10);
      const endStr = typeof end === "string" ? end : end.toISOString().slice(0, 10);
      
      const tasks = await api.getTasksByDateRange(startStr, endStr);
      
      if (!tasks || !Array.isArray(tasks)) {
        return [];
      }
      
      const normalizedTasks = tasks
        .map(task => {
          if (!task || !task.id) return null;
          
          let taskDate = task.date;
          if (taskDate) {
            if (typeof taskDate === 'string') {
              if (taskDate.includes('T')) taskDate = taskDate.split('T')[0];
              if (taskDate.includes(' ')) taskDate = taskDate.split(' ')[0];
              if (taskDate.length > 10) taskDate = taskDate.substring(0, 10);
            } else if (taskDate instanceof Date) {
              taskDate = taskDate.toISOString().slice(0, 10);
            }
          }
          
          return { ...task, date: taskDate };
        })
        .filter(task => task && task.date);
      
      set((state) => {
        const existingTaskMap = new Map(state.tasks.map(t => [t.id, t]));
        normalizedTasks.forEach(task => {
          existingTaskMap.set(task.id, task);
        });
        return { tasks: Array.from(existingTaskMap.values()) };
      });
      
      return normalizedTasks;
    } catch (error) {
      return [];
    }
  },

  // -------- REMINDERS -------- //

  loadReminders: async () => {
    try {
      const r = await api.getAllReminders();
      set({ reminders: r || [] });
    } catch (error) {
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
      return null;
    }
  },

  getNoteForDate: (date: Date | string) => {
    // Synchronous getter - returns cached note if available
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
  
  conversations: (() => {
    // Load from localStorage on init
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("lifeos_conversations");
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (e) {
        console.error("Failed to load conversations from localStorage:", e);
      }
    }
    return [];
  })(),
  
  chatHistory: (() => {
    // Load chat history (separate conversations) from localStorage
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("lifeos_chat_history");
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (e) {
        console.error("Failed to load chat history from localStorage:", e);
      }
    }
    return [];
  })(),
  
  addMessage: (role: "user" | "assistant", content: string, ui?: any) => {
    const msg = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date().toISOString(),
      ...(ui && { ui }),
    };
    const updated = [...get().conversations, msg];
    set({ conversations: updated });
    
    // Persist to localStorage
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("lifeos_conversations", JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save conversations to localStorage:", e);
      }
    }
    
    return msg;
  },
  
  clearConversations: () => {
    set({ conversations: [] });
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("lifeos_conversations");
      } catch (e) {
        console.error("Failed to clear conversations from localStorage:", e);
      }
    }
  },
  
  saveChatToHistory: (title: string) => {
    const currentChat = get().conversations;
    if (currentChat.length === 0) return;
    
    const chatEntry = {
      id: Date.now().toString(),
      title,
      messages: [...currentChat],
      date: new Date().toISOString(),
    };
    
    const history = [...get().chatHistory, chatEntry];
    set({ chatHistory: history });
    
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("lifeos_chat_history", JSON.stringify(history));
      } catch (e) {
        console.error("Failed to save chat history:", e);
      }
    }
  },
  
  loadChatFromHistory: (chatId: string) => {
    const chat = get().chatHistory.find(c => c.id === chatId);
    if (chat) {
      set({ conversations: chat.messages });
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("lifeos_conversations", JSON.stringify(chat.messages));
        } catch (e) {
          console.error("Failed to load chat:", e);
        }
      }
    }
  },
  
  deleteChatFromHistory: (chatId: string) => {
    const history = get().chatHistory.filter(c => c.id !== chatId);
    set({ chatHistory: history });
    
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("lifeos_chat_history", JSON.stringify(history));
      } catch (e) {
        console.error("Failed to delete chat:", e);
      }
    }
  },

  // -------- CATEGORIES -------- //

  loadCategories: async () => {
    try {
      const categories = await api.getAllCategories();
      if (categories && Array.isArray(categories)) {
        set({ categories });
      }
    } catch (error) {
      // Keep existing categories on error
    }
  },

  addCategory: async (label: string, color: string) => {
    try {
      await api.createCategory({ label, color });
      // Reload categories and bootstrap to ensure all task mappings are updated
      await get().loadCategories();
      await get().loadBootstrap();
    } catch (error) {
      throw error;
    }
  },

  updateCategory: async (id: string, updates: Partial<Omit<Category, 'id'>>) => {
    try {
      await api.updateCategory(id, updates);
      // Reload categories and bootstrap to ensure all task mappings are updated
      // especially important if a global category was converted to a user category (ID changes)
      await get().loadCategories();
      await get().loadBootstrap();
    } catch (error) {
      throw error;
    }
  },

  deleteCategory: async (id: string) => {
    try {
      await api.deleteCategory(id);
      // Reload categories and bootstrap to ensure all task mappings are updated
      await get().loadCategories();
      await get().loadBootstrap();
    } catch (error) {
      throw error;
    }
  },
}));
