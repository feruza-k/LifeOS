import { ValueType } from "@/components/lifeos/ValueTag";

export interface Task {
  id: string;
  title: string;
  time?: string;
  endTime?: string; // For tasks spanning multiple time blocks
  completed: boolean;
  value: ValueType;
  date: string; // ISO date string YYYY-MM-DD
  createdAt: string;
  movedFrom?: string; // Original date if task was moved
}

export interface DailyNote {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckIn {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  completedTaskIds: string[];
  incompleteTaskIds: string[];
  movedTasks: { taskId: string; newDate: string }[];
  note?: string;
  mood?: string; // Emoji mood from reflection (e.g., "😊", "😌", "😐", "😴")
  timestamp: string;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  recurring?: "daily" | "weekly" | "monthly" | "yearly";
  visible: boolean; // If false, only AI knows about it
  createdAt: string;
}

export interface MonthlyFocus {
  id: string;
  month: string; // YYYY-MM format
  title: string;
  description?: string;
  progress?: number; // 0-100
  createdAt: string;
}

export interface UserSettings {
  checkInTime: string; // 24h format "21:00"
  categories: ValueType[];
  coreAIName: string;
  theme: "light" | "dark" | "system";
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  actions?: {
    type: "add_task" | "move_task" | "delete_task" | "set_focus" | "add_reminder";
    data: any;
  }[];
}
