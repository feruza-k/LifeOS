import { BASE_URL } from "@/constants/config";

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let refreshHasFailed = false;
let hasRedirected = false;

async function request(path: string, options: RequestInit = {}, retryCount = 0, skipRefresh = false): Promise<any> {
  const url = `${BASE_URL}${path}`;
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  // Debug logging for mobile
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    console.log(`[API] Requesting: ${url}`);
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: "include",  // Include cookies (httpOnly tokens)
    });
    
    if (res.status === 401) {
      // If we should skip refresh (e.g., for signup, session checks), read the actual error
      if (skipRefresh || refreshHasFailed) {
        // Read the actual error message from the backend
        const responseText = await res.text();
        let errorMessage = "Unauthorized - please log in again";
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      // Prevent infinite loops - don't retry if we've already tried
      if (retryCount > 1) {
        throw new Error("Unauthorized - please log in again");
      }
      
      // Prevent multiple simultaneous refresh attempts
      if (isRefreshing && refreshPromise) {
        const refreshSucceeded = await refreshPromise;
        if (refreshSucceeded) {
          // Retry the original request after successful refresh
          return request(path, options, retryCount + 1, skipRefresh);
        }
        // Refresh failed, mark it so we don't try again
        refreshHasFailed = true;
      } else if (!isRefreshing) {
        // Try to refresh token
        isRefreshing = true;
        refreshPromise = (async () => {
          try {
            const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
              method: "POST",
              credentials: "include",
            });
            
            const succeeded = refreshRes.ok;
            
            if (!succeeded) {
              refreshHasFailed = true;
              // Only redirect once
              if (!hasRedirected && typeof window !== "undefined" && path !== "/auth/me") {
                hasRedirected = true;
                // Don't redirect if we're already on auth pages
                if (!window.location.pathname.startsWith("/auth") && !window.location.pathname.startsWith("/verify-email")) {
                  window.location.href = "/auth";
                }
              }
            }
            
            return succeeded;
          } catch {
            refreshHasFailed = true;
            if (!hasRedirected && typeof window !== "undefined" && path !== "/auth/me") {
              hasRedirected = true;
              if (!window.location.pathname.startsWith("/auth") && !window.location.pathname.startsWith("/verify-email")) {
                window.location.href = "/auth";
              }
            }
            return false;
          } finally {
            isRefreshing = false;
            refreshPromise = null;
          }
        })();
        
        const refreshSucceeded = await refreshPromise;
        
        if (refreshSucceeded) {
          // Retry original request after successful refresh
          return request(path, options, retryCount + 1, skipRefresh);
        }
      }
      
      throw new Error("Unauthorized - please log in again");
    }
    
    // Reset refresh failed flag on successful request (user might have logged in)
    if (res.ok && refreshHasFailed) {
      refreshHasFailed = false;
      hasRedirected = false;
    }
    
    if (!res.ok) {
      // Read response as text first (can only read once)
      const responseText = await res.text();
      let errorMessage = `API error ${res.status}`;
      
      // Special handling for 405 (Method Not Allowed) - usually CORS or routing issue
      if (res.status === 405) {
        errorMessage = `Method not allowed. This might be a CORS issue. Check if the backend is accessible at ${BASE_URL}`;
        console.error(`[API] 405 Error for ${url}. Response:`, responseText);
      } else {
        try {
          // Try to parse as JSON for structured error
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          // If not JSON, use the text as error message
          errorMessage = responseText || errorMessage;
        }
      }
      throw new Error(errorMessage);
    }
    // For successful response, read as JSON
    return res.json();
  } catch (error: any) {
    // Enhanced error logging for debugging
    console.error(`[API Error] URL: ${url}`, error);
    
    if (error instanceof TypeError) {
      const isNetworkError = 
        error.message.includes("fetch") ||
        error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError") ||
        error.message === "Network request failed";
      
      if (isNetworkError) {
        const errorMsg = `Cannot connect to backend at ${BASE_URL}. Make sure it's running and accessible from your network.`;
        console.error(`[API] Network error: ${errorMsg}`);
        throw new Error(errorMsg);
      }
    }
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error(error?.message || String(error));
  }
}

export const api = {
  // --- Auth ---
  login: async (email: string, password: string) => {
    const formData = new FormData();
    formData.append("username", email);
    formData.append("password", password);
    
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      body: formData,
      credentials: "include",  // Include cookies
    });
    
    if (!res.ok) {
      let errorMessage = "Login failed";
      // Read response as text first (can only read once)
      const responseText = await res.text();
      try {
        // Try to parse as JSON
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.detail || errorMessage;
      } catch {
        // If not JSON, use the text as error message
        errorMessage = responseText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    // For successful response, read as JSON
    return res.json();
  },

  signup: async (email: string, password: string, confirmPassword: string, username?: string) => {
    // Skip token refresh for signup - user doesn't have tokens yet
    return request("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, confirm_password: confirmPassword, username }),
    }, 0, true); // skipRefresh = true
  },

  getCurrentUser: () => {
    // Skip auto-refresh to avoid loops, just check session
    // This endpoint returns 401 if not logged in, which is normal - don't treat as error
    return request("/auth/me", {}, 0, true).catch((error) => {
      // If it's a network error, re-throw it
      if (error?.message?.includes("network") || error?.message?.includes("fetch") || error?.message?.includes("connect")) {
        throw error;
      }
      // Otherwise, it's probably a 401 (not logged in) - throw a specific error
      throw new Error("Not authenticated");
    });
  },

  verifyEmail: (token: string) =>
    request("/auth/verify-email-by-token", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  resendVerification: (email: string) =>
    request("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  forgotPassword: (email: string) =>
    request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string, confirmPassword: string) =>
    request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword, confirm_password: confirmPassword }),
    }),

  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword }),
    }),

  updateProfile: (updates: { username?: string }) =>
    request("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  deleteAccount: () =>
    request("/auth/account", {
      method: "DELETE",
    }),

  logout: () =>
    request("/auth/logout", {
      method: "POST",
    }),

  refreshToken: () =>
    request("/auth/refresh", {
      method: "POST",
    }),

  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const url = `${BASE_URL}/auth/avatar`;
    
    try {
      const res = await fetch(url, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("lifeos-token")}`,
        },
      });
      
      if (!res.ok) {
        const responseText = await res.text();
        let errorMessage = `API error ${res.status}`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      return res.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(`Cannot connect to backend at ${BASE_URL}. Make sure it's running.`);
      }
      throw error;
    }
  },

  deleteAvatar: () =>
    request("/auth/avatar", {
      method: "DELETE",
    }),

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

  // --- Photos ---
  uploadPhoto: async (file: File, date: string) => {
    const formData = new FormData();
    formData.append("file", file);
    const url = `${BASE_URL}/photos/upload?date=${date}`;
    
    try {
      const res = await fetch(url, {
        method: "POST",
        body: formData,
        credentials: "include", // Include cookies (httpOnly tokens) for authentication
      });
      
      if (res.status === 401) {
        throw new Error("Unauthorized - please log in again");
      }
      
      if (!res.ok) {
        const responseText = await res.text();
        let errorMessage = `API error ${res.status}`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      return res.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        console.error("❌ Network error - is the backend running?", error);
        throw new Error(`Cannot connect to backend at ${BASE_URL}. Make sure it's running.`);
      }
      throw error;
    }
  },

  getPhotoUrl: (filename: string) => `${BASE_URL}/photos/${filename}`,

  deletePhoto: (filename: string, date: string) =>
    request(`/photos/${filename}?date=${date}`, {
      method: "DELETE",
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

  // --- Global Notes ---
  getGlobalNotes: (params?: { include_archived?: boolean; sort_by?: string; tags?: string; pinned_only?: boolean }) => {
    const queryParams = new URLSearchParams();
    if (params?.include_archived) queryParams.append("include_archived", "true");
    if (params?.sort_by) queryParams.append("sort_by", params.sort_by);
    if (params?.tags) queryParams.append("tags", params.tags);
    if (params?.pinned_only) queryParams.append("pinned_only", "true");
    const query = queryParams.toString();
    return request(`/global-notes${query ? `?${query}` : ""}`);
  },

  getGlobalNote: (noteId: string) => request(`/global-notes/${noteId}`),

  createGlobalNote: (note: { title?: string; content: string; pinned?: boolean; archived?: boolean }) =>
    request("/global-notes", {
      method: "POST",
      body: JSON.stringify(note),
    }),

  updateGlobalNote: (noteId: string, note: { title?: string; content?: string; pinned?: boolean; archived?: boolean }) =>
    request(`/global-notes/${noteId}`, {
      method: "PUT",
      body: JSON.stringify(note),
    }),

  deleteGlobalNote: (noteId: string) =>
    request(`/global-notes/${noteId}`, {
      method: "DELETE",
    }),

  pinGlobalNote: (noteId: string) =>
    request(`/global-notes/${noteId}/pin`, {
      method: "POST",
    }),

  unpinGlobalNote: (noteId: string) =>
    request(`/global-notes/${noteId}/unpin`, {
      method: "POST",
    }),

  archiveGlobalNote: (noteId: string) =>
    request(`/global-notes/${noteId}/archive`, {
      method: "POST",
    }),

  unarchiveGlobalNote: (noteId: string) =>
    request(`/global-notes/${noteId}/unarchive`, {
      method: "POST",
    }),

  uploadNoteImage: async (noteId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/global-notes/${noteId}/image`, {
      method: "POST",
      headers: {}, // Let browser set Content-Type for FormData
      body: formData,
    });
  },

  deleteNoteImage: (noteId: string) =>
    request(`/global-notes/${noteId}/image`, {
      method: "DELETE",
    }),

  getNoteImageUrl: (noteId: string) => `${BASE_URL}/global-notes/${noteId}/image`,

  uploadNoteAudio: async (noteId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/global-notes/${noteId}/audio`, {
      method: "POST",
      headers: {}, // Let browser set Content-Type for FormData
      body: formData,
    });
  },

  deleteNoteAudio: (noteId: string) =>
    request(`/global-notes/${noteId}/audio`, {
      method: "DELETE",
    }),

  getNoteAudioUrl: (noteId: string) => `${BASE_URL}/global-notes/${noteId}/audio`,

  // --- Core AI Chat ---
  chat: (message: string, conversationHistory?: Array<{ role: string; content: string }>) =>
    request("/assistant/chat", {
      method: "POST",
      body: JSON.stringify({ 
        message,
        conversation_history: conversationHistory || []
      }),
    }),

  confirmAction: () =>
    request("/assistant/confirm", {
      method: "POST",
    }),

  getContextActions: (currentView?: string, selectedTaskId?: string, selectedDate?: string) => {
    const params = new URLSearchParams();
    if (currentView) params.append("current_view", currentView);
    if (selectedTaskId) params.append("selected_task_id", selectedTaskId);
    if (selectedDate) params.append("selected_date", selectedDate);
    return request(`/assistant/context-actions?${params.toString()}`);
  },

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
