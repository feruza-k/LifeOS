import { BASE_URL } from "@/constants/config";

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
  
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    });
    
    console.log(`✅ API Response: ${res.status} ${path}`);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ API ERROR:", res.status, path, errorText);
      throw new Error(`API error ${res.status}: ${errorText}`);
    }
    return res.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.error("❌ Network error - is the backend running?", error);
      console.error(`Backend URL: ${BASE_URL}`);
      throw new Error(`Cannot connect to backend at ${BASE_URL}. Make sure it's running.`);
    }
    throw error;
  }
}

export const api = {
  // --- Bootstrap / Today ---
  getBootstrap: () => request("/assistant/bootstrap"),
  getToday: (date?: string) =>
    request(`/assistant/today${date ? `?date=${date}` : ""}`),

  // --- Tasks ---
  getTasksByDate: (date: string) =>
    request(`/tasks/by-date?date=${date}`),

  getTasksByDateRange: (start: string, end: string) =>
    request(`/tasks/calendar?start=${start}&end=${end}`),

  createTask: (task: any) =>
    request("/tasks", {
      method: "POST",
      body: JSON.stringify(task),
    }),

  updateTask: (id: string, updates: any) =>
    request(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  deleteTask: (id: string) =>
    request(`/tasks/${id}`, { method: "DELETE" }),

  moveTask: (id: string, newDate: string) =>
    request(`/tasks/${id}/move?new_date=${newDate}`, {
      method: "POST",
    }),

  completeTask: (id: string) =>
    request(`/tasks/${id}/complete`, { method: "POST" }),

  // --- Notes ---
  getNote: (date: string) =>
    request(`/notes?date=${date}`),

  saveNote: (note: any) =>
    request("/notes", {
      method: "POST",
      body: JSON.stringify(note),
    }),

  // --- Check-ins ---
  getCheckIn: (date: string) =>
    request(`/checkins?date=${date}`),

  saveCheckIn: (data: any) =>
    request("/checkins", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // --- Reminders ---
  getAllReminders: () => request("/reminders"),

  createReminder: (reminder: any) =>
    request("/reminders", {
      method: "POST",
      body: JSON.stringify(reminder),
    }),

  updateReminder: (id: string, updates: any) =>
    request(`/reminders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  deleteReminder: (id: string) =>
    request(`/reminders/${id}`, { method: "DELETE" }),

  // --- Monthly Focus ---
  getMonthlyFocus: (month: string) =>
    request(`/monthly-focus?month=${month}`),

  saveMonthlyFocus: (focus: any) =>
    request("/monthly-focus", {
      method: "POST",
      body: JSON.stringify(focus),
    }),

  // --- Core AI Chat ---
  chat: (message: string) =>
    request("/assistant/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  confirmAction: () =>
    request("/assistant/confirm", {
      method: "POST",
    }),

  // --- Categories ---
  getAllCategories: () => request("/categories"),

  getCategory: (id: string) => request(`/categories/${id}`),

  createCategory: (category: any) =>
    request("/categories", {
      method: "POST",
      body: JSON.stringify(category),
    }),

  updateCategory: (id: string, updates: any) =>
    request(`/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  deleteCategory: (id: string) =>
    request(`/categories/${id}`, { method: "DELETE" }),
};
