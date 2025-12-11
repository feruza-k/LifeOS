import { useState, useCallback } from "react";
import { useLifeOSStore } from "@/stores/useLifeOSStore";
import { api } from "@/lib/api";
import { ConversationMessage } from "@/types/lifeos";

// SolAI hook - connects to backend assistant
export function useCoreAI() {
  const store = useLifeOSStore();
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (userMessage: string) => {
    // Add user message to conversation
    store.addMessage("user", userMessage);
    
    setIsLoading(true);
    
    try {
      // Call backend assistant endpoint
      const response = await api.chat(userMessage);
      
      // Add assistant response
      const actions = response.ui ? [response.ui] : undefined;
      store.addMessage("assistant", response.assistant_response, actions);
      
      // Handle UI actions from backend
      if (response.ui) {
        const uiAction = response.ui;
        
        // Handle different action types
        if (uiAction.action === "add_task" && uiAction.task) {
          // Task was created - reload today view to show new task
          const taskDate = uiAction.task.date || new Date().toISOString().slice(0, 10);
          await store.loadToday(taskDate);
        } else if (uiAction.action === "update_task" || uiAction.action === "apply_reschedule") {
          // Task was updated/rescheduled - reload today view
          const currentDate = store.today?.date || new Date().toISOString().slice(0, 10);
          await store.loadToday(currentDate);
        } else if (uiAction.action === "refresh") {
          // Refresh current view
          const currentDate = store.today?.date || new Date().toISOString().slice(0, 10);
          await store.loadToday(currentDate);
        }
        // Other actions like "confirm_create", "confirm_reschedule" are handled by user confirmation
      }
    } catch (error) {
      console.error("Failed to send message to SolAI:", error);
      store.addMessage("assistant", "Sorry, I'm having trouble connecting right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [store]);

  return {
    messages: store.conversations,
    sendMessage,
    isLoading,
    clearHistory: store.clearConversations,
  };
}
