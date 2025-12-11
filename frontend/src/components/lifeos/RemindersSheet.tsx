import { useState } from "react";
import { Bell, Plus, X, Clock, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Reminder } from "@/types/lifeos";
import { cn } from "@/lib/utils";

interface RemindersSheetProps {
  reminders: Reminder[];
  onAddReminder: (reminder: Omit<Reminder, "id" | "createdAt">) => void;
  onDeleteReminder: (id: string) => void;
}

export function RemindersSheet({ reminders, onAddReminder, onDeleteReminder }: RemindersSheetProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newReminder, setNewReminder] = useState("");
  const [reminderDate, setReminderDate] = useState("");

  const handleAddReminder = () => {
    if (newReminder.trim()) {
      onAddReminder({
        title: newReminder.trim(),
        dueDate: reminderDate || undefined,
        visible: true,
      });
      setNewReminder("");
      setReminderDate("");
      setIsAdding(false);
    }
  };

  const activeReminders = reminders.filter(r => r.visible);
  const hiddenReminders = reminders.filter(r => !r.visible);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
        >
          <Bell className="w-5 h-5 text-muted-foreground" />
          {activeReminders.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
              {activeReminders.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-serif">
            <Bell className="w-5 h-5 text-primary" />
            Reminders
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Add Reminder */}
          {!isAdding ? (
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="w-4 h-4" />
              Add reminder
            </Button>
          ) : (
            <div className="p-4 rounded-xl bg-muted/50 space-y-3">
              <Input
                placeholder="What do you want to remember?"
                value={newReminder}
                onChange={(e) => setNewReminder(e.target.value)}
                className="bg-background"
                autoFocus
              />
              <Input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="bg-background"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddReminder} className="flex-1">
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Active Reminders */}
          {activeReminders.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">
                Active
              </p>
              {activeReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-card shadow-soft"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans font-medium text-sm text-foreground">
                      {reminder.title}
                    </p>
                    {reminder.dueDate && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(reminder.dueDate), "MMM d, yyyy")}
                      </p>
                    )}
                    {reminder.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {reminder.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onDeleteReminder(reminder.id)}
                    className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden (AI-managed) */}
          {hiddenReminders.length > 0 && (
            <div className="space-y-2 opacity-60">
              <p className="text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">
                AI-Managed (Hidden)
              </p>
              {hiddenReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/30"
                >
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <p className="font-sans text-sm text-muted-foreground flex-1">
                    {reminder.title}
                  </p>
                </div>
              ))}
            </div>
          )}

          {reminders.length === 0 && (
            <div className="text-center py-8">
              <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No reminders yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Add reminders or ask SolAI to remember things for you
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}