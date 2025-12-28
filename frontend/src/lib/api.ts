import { BASE_URL } from "@/constants/config";

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let refreshHasFailed = false;
let hasRedirected = false;

async function request(path: string, options: RequestInit = {}, retryCount = 0, skipRefresh = false): Promise<any> {
  // Ensure BASE_URL has protocol
  let baseUrl = BASE_URL;
  if (!baseUrl.match(/^https?:\/\//) && typeof window !== 'undefined') {
    // If no protocol, add https:// in production
    const isDev = import.meta.env.DEV;
    baseUrl = isDev ? `http://${baseUrl}` : `https://${baseUrl}`;
    console.warn(`[API] BASE_URL missing protocol, added: ${baseUrl}`);
  }
  
  const url = `${baseUrl}${path}`;
  
  // Auto-detect timezone from browser (with fallback)
  let timezone = 'UTC';
  try {
    if (typeof window !== 'undefined') {
      const resolved = Intl.DateTimeFormat().resolvedOptions();
      timezone = resolved.timeZone || 'UTC';
    }
  } catch (error) {
    // Fallback to UTC if timezone detection fails
    console.warn('Failed to detect timezone, using UTC:', error);
    timezone = 'UTC';
  }

  // Build headers - don't set Content-Type for FormData (browser sets it with boundary)
  const isFormData = options.body instanceof FormData;
  
  // Start with timezone header
  const headers: HeadersInit = {
    "X-Timezone": timezone,
  };
  
  // Merge existing headers if provided
  if (options.headers) {
    if (options.headers instanceof Headers) {
      // Convert Headers object to plain object
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else {
      // Merge plain object
      Object.assign(headers, options.headers);
    }
  }
  
  // Only set Content-Type if it's not FormData and not already set
  // FormData requests must let the browser set Content-Type with boundary
  if (!isFormData && !("Content-Type" in headers) && !("content-type" in headers)) {
    headers["Content-Type"] = "application/json";
  }

  // Debug logging for mobile
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    console.log(`[API] Requesting: ${url}`);
  }

  try {
    // Build fetch options - ensure we don't override headers or credentials
    const fetchOptions: RequestInit = {
      ...options,
      headers,  // Our merged headers (with timezone) override any in options
      credentials: "include",  // Always include cookies (httpOnly tokens)
    };
    
    console.log(`[API] Making ${fetchOptions.method || 'GET'} request to ${url}`, {
      hasHeaders: !!fetchOptions.headers,
      headerKeys: fetchOptions.headers ? Object.keys(fetchOptions.headers as Record<string, string>) : [],
      hasBody: !!fetchOptions.body,
      credentials: fetchOptions.credentials
    });
    
    const res = await fetch(url, fetchOptions);
    
    console.log(`[API] Response: ${res.status} ${res.statusText} for ${url}`);
    
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
    const data = await res.json();
    // Safety check: if response contains an error field, treat it as an error
    if (data && typeof data === 'object' && 'error' in data) {
      throw new Error(data.error || 'An error occurred');
    }
    return data;
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
    
    // Ensure BASE_URL uses HTTPS in production (Railway redirects HTTP to HTTPS, causing 405)
    const loginUrl = `${BASE_URL}/auth/login`;
    console.log(`[API] Login request to: ${loginUrl}`);
    console.log(`[API] BASE_URL value: ${BASE_URL}`);
    console.log(`[API] Full login URL: ${loginUrl}`);
    
    try {
      const res = await fetch(loginUrl, {
        method: "POST",
        body: formData,
        credentials: "include",  // Include cookies
        // Don't set Content-Type header - browser sets it automatically for FormData with boundary
      });
      
      console.log(`[API] Login response status: ${res.status}, statusText: ${res.statusText}`);
      console.log(`[API] Login response URL: ${res.url}`);
      
      if (!res.ok) {
        let errorMessage = "Login failed";
        // Read response as text first (can only read once)
        const responseText = await res.text();
        console.error(`[API] Login failed - Status: ${res.status}, Response: ${responseText}`);
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
      console.log(`[API] Login successful`);
      return res.json();
    } catch (error) {
      // Log network errors
      if (error instanceof TypeError && error.message.includes("fetch")) {
        console.error(`[API] Network error during login:`, error);
        throw new Error(`Network error: ${error.message}`);
      }
      throw error;
    }
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
    // Explicitly ensure credentials are included
    console.log("[API] getCurrentUser - checking credentials, BASE_URL:", BASE_URL);
    return request("/auth/me", {
      credentials: "include",  // Explicitly include cookies
    }, 0, true).catch((error) => {
      // If it's a network error, re-throw it
      if (error?.message?.includes("network") || error?.message?.includes("fetch") || error?.message?.includes("connect")) {
        throw error;
      }
      // Log the actual error for debugging
      console.error("[API] getCurrentUser failed:", error?.message || error);
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

  getMonthlyGoals: (month: string) =>
    request(`/monthly-goals?month=${month}`),

  saveMonthlyFocus: (focus: any) =>
    request("/monthly-focus", {
      method: "POST",
      body: JSON.stringify(focus),
    }),

  saveMonthlyGoals: (month: string, goals: any[]) =>
    request("/monthly-goals", {
      method: "POST",
      body: JSON.stringify({ month, goals }),
    }),

  deleteMonthlyFocus: (focusId: string) =>
    request(`/monthly-focus/${focusId}`, { method: "DELETE" }),

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

  getMorningBriefing: () => {
    // Get user's language preference
    const userLanguage = typeof window !== 'undefined' 
      ? (localStorage.getItem("lifeos_language") || "en")
      : "en";
    return request("/assistant/morning-briefing", {
      headers: {
        "Accept-Language": userLanguage
      }
    });
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

  // Align endpoints
  getAlignSummary: () => request("/align/summary"),
  getAlignAnalytics: () => request("/align/analytics"),
  formatDate: (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};
