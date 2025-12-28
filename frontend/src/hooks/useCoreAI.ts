import { useState, useCallback } from "react";
import { useLifeOSStore } from "@/stores/useLifeOSStore";
import { api } from "@/lib/api";
import { ConversationMessage } from "@/types/lifeos";

import { startOfMonth, endOfMonth, parseISO } from "date-fns";

// SolAI hook - connects to backend assistant
export function useCoreAI() {
  const store = useLifeOSStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCalendarIfNeeded = async (dateStr: string) => {
    // If the user is on the calendar view, we should refresh the whole month
    // to ensure any new tasks or moves are reflected in the grid
    if (window.location.pathname === "/calendar") {
      try {
        const date = parseISO(dateStr);
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        await store.loadTasksForDateRange(monthStart, monthEnd);
      } catch (e) {
        console.error("Failed to refresh calendar after assistant action:", e);
      }
    }
  };

  const sendMessage = useCallback(async (userMessage: string) => {
    // Add user message to conversation
    store.addMessage("user", userMessage);
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Prepare conversation history (last 10 messages for context)
      const conversationHistory = store.conversations
        .slice(-10)
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      
      // Call backend assistant endpoint with conversation history
      const response = await api.chat(userMessage, conversationHistory);
      
      // Add assistant response with UI action
      store.addMessage("assistant", response.assistant_response, response.ui);
      
      // Handle UI actions from backend (non-confirmation actions)
      if (response.ui) {
        const uiAction = response.ui;
        
        // Handle different action types
        if (uiAction.action === "add_task" && uiAction.task) {
          // Task was created - reload today view to show new task
          const taskDate = uiAction.task.date || new Date().toISOString().slice(0, 10);
          await store.loadToday(taskDate);
          await refreshCalendarIfNeeded(taskDate);
        } else if (uiAction.action === "update_task" || uiAction.action === "apply_reschedule") {
          // Task was updated/rescheduled - reload today view
          const currentDate = store.today?.date || new Date().toISOString().slice(0, 10);
          await store.loadToday(currentDate);
          await refreshCalendarIfNeeded(currentDate);
        } else if (uiAction.action === "refresh") {
          // Refresh current view
          const currentDate = store.today?.date || new Date().toISOString().slice(0, 10);
          await store.loadToday(currentDate);
          await refreshCalendarIfNeeded(currentDate);
        }
        // "confirm_create" and "confirm_reschedule" are handled by confirmation UI
      }
    } catch (error: any) {
      console.error("Failed to send message to SolAI:", error);
      let errorMessage = "Sorry, I'm having trouble connecting right now. Please try again.";
      
      if (error?.message) {
        if (error.message.includes("OPENAI_API_KEY") || error.message.includes("API key")) {
          errorMessage = "AI service is not configured. Please check backend settings.";
        } else if (error.message.includes("network") || error.message.includes("fetch")) {
          errorMessage = "Cannot connect to the server. Please check your connection.";
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      store.addMessage("assistant", errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [store]);

  const confirmAction = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.confirmAction();
      
      // Add assistant response
      store.addMessage("assistant", response.assistant_response, response.ui);
      
      // Handle UI actions
      if (response.ui) {
        const uiAction = response.ui;
        
        if (uiAction.action === "add_task" && uiAction.task) {
          const taskDate = uiAction.task.date || new Date().toISOString().slice(0, 10);
          await store.loadToday(taskDate);
          await refreshCalendarIfNeeded(taskDate);
        } else if (uiAction.action === "update_task" || uiAction.action === "apply_reschedule") {
          const currentDate = store.today?.date || new Date().toISOString().slice(0, 10);
          await store.loadToday(currentDate);
          await refreshCalendarIfNeeded(currentDate);
        } else if (uiAction.action === "refresh") {
          const currentDate = store.today?.date || new Date().toISOString().slice(0, 10);
          await store.loadToday(currentDate);
          await refreshCalendarIfNeeded(currentDate);
        }
      }
    } catch (error: any) {
      console.error("Failed to confirm action:", error);
      const errorMessage = error?.message || "Sorry, I'm having trouble processing that. Please try again.";
      setError(errorMessage);
      store.addMessage("assistant", errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [store]);

  return {
    messages: store.conversations,
    sendMessage,
    confirmAction,
    isLoading,
    error,
    clearHistory: store.clearConversations,
  };
}
