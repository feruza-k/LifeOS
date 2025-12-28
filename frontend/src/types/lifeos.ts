import { ValueType } from "@/components/lifeos/ValueTag";

export interface Category {
  id: string;
  label: string;
  color: string;
  user_id?: string | null; // null means it's a global category
}

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
  time?: string; // 24h format "14:00"
  type?: "notify" | "show";
  recurring?: "daily" | "weekly" | "monthly" | "yearly";
  visible: boolean; // If false, only AI knows about it
  note?: string;
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

export interface UIAction {
  action: "confirm_create" | "confirm_reschedule" | "add_task" | "apply_reschedule" | "update_task" | "refresh";
  task_id?: string;
  task_preview?: any;
  task?: any;
  new_time?: string;
  options?: string[];
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  ui?: UIAction;
}
