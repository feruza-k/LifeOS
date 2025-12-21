import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek, isThisYear } from "date-fns";

export function formatRelativeTime(timestamp: string | Date): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const now = new Date();
  
  // Less than 1 minute ago
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60000) {
    return "Just now";
  }
  
  // Today - show time
  if (isToday(date)) {
    return format(date, "h:mm a");
  }
  
  // Yesterday
  if (isYesterday(date)) {
    return "Yesterday";
  }
  
  // This week - show day name
  if (isThisWeek(date)) {
    return format(date, "EEEE");
  }
  
  // This year - show month and day
  if (isThisYear(date)) {
    return format(date, "MMM d");
  }
  
  // Older - show full date
  return format(date, "MMM d, yyyy");
}

export function formatMessageTime(timestamp: string | Date): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  
  if (isToday(date)) {
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return format(date, "h:mm a");
  }
  
  if (isYesterday(date)) {
    return `Yesterday ${format(date, "h:mm a")}`;
  }
  
  if (isThisWeek(date)) {
    return format(date, "EEE h:mm a");
  }
  
  return format(date, "MMM d, h:mm a");
}

