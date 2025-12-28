/**
 * Browser Notifications Manager
 * Handles permission requests and notification scheduling
 */

export class NotificationManager {
  private static permission: NotificationPermission = "default";

  static async requestPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
      console.warn("This browser does not support notifications");
      return false;
    }

    if (Notification.permission === "granted") {
      this.permission = "granted";
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === "granted";
    }

    return false;
  }

  static async showNotification(
    title: string,
    options: NotificationOptions = {}
  ): Promise<void> {
    if (!("Notification" in window)) {
      return;
    }

    if (Notification.permission !== "granted") {
      const granted = await this.requestPermission();
      if (!granted) {
        return;
      }
    }

    // Show notification
    const notification = new Notification(title, {
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: options.tag || "lifeos-notification",
      requireInteraction: options.requireInteraction || false,
      silent: options.silent || false,
      ...options,
    });

    // Auto-close after 5 seconds unless requireInteraction is true
    if (!options.requireInteraction) {
      setTimeout(() => {
        notification.close();
      }, 5000);
    }

    // Handle click
    notification.onclick = () => {
      window.focus();
      notification.close();
      if (options.onClick) {
        options.onClick();
      }
    };
  }

  static async scheduleReminder(
    reminder: {
      id: string;
      title: string;
      dueDate?: string;
      time?: string;
      description?: string;
    }
  ): Promise<void> {
    if (!reminder.dueDate || !reminder.time) {
      return; // Can't schedule without date and time
    }

    const reminderDate = new Date(`${reminder.dueDate}T${reminder.time}`);
    const now = new Date();
    const delay = reminderDate.getTime() - now.getTime();

    // Only schedule if in the future
    if (delay > 0 && delay < 7 * 24 * 60 * 60 * 1000) {
      // Max 7 days ahead
      setTimeout(() => {
        this.showNotification(reminder.title, {
          body: reminder.description || "Reminder from LifeOS",
          tag: `reminder-${reminder.id}`,
          requireInteraction: false,
        });
      }, delay);
    }
  }

  static checkPermission(): NotificationPermission {
    if (!("Notification" in window)) {
      return "denied";
    }
    return Notification.permission;
  }
}

