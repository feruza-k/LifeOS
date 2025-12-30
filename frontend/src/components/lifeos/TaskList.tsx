import { TaskItem, Task } from "./TaskItem";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskSubgroup {
  title: string;
  tasks: Task[];
}

interface TaskGroup {
  title: string;
  tasks: Task[];
  subgroups?: TaskSubgroup[];
}

interface TaskListProps {
  groups: TaskGroup[];
  onToggleTask: (id: string) => void;
  onDeleteTask?: (id: string) => void;
  onAddTask?: () => void;
}

export function TaskList({ groups, onToggleTask, onDeleteTask, onAddTask }: TaskListProps) {
  return (
    <div className="px-4 py-4 space-y-6 animate-slide-up" style={{ animationDelay: "0.3s" }}>
      {groups.map((group, groupIndex) => {
        const isScheduled = group.title === "Scheduled";
        const hasTasks = group.tasks.length > 0;
        
        return (
          <div key={group.title}>
            {/* Main Section Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                {group.title}
              </h3>
              {groupIndex === 0 && onAddTask && (
                <button
                  onClick={onAddTask}
                  className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {isScheduled && group.subgroups ? (
              // Scheduled section with Morning/Afternoon/Evening subgroups
              <div className="space-y-4">
                {group.subgroups.map((subgroup) => (
                  <div key={subgroup.title}>
                    <h4 className="text-xs font-sans font-medium text-muted-foreground/70 uppercase tracking-wide mb-2 px-1">
                      {subgroup.title}
                    </h4>
                    {subgroup.tasks.length > 0 ? (
                      <div className="space-y-2">
                        {subgroup.tasks.map((task) => (
                          <TaskItem 
                            key={task.id} 
                            task={task} 
                            onToggle={onToggleTask}
                            onDelete={onDeleteTask}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {!hasTasks && (
                  <div className="text-center py-4 text-muted-foreground/50 text-sm font-sans">
                    No scheduled tasks
                  </div>
                )}
              </div>
            ) : (
              // Anytime section (or other simple sections)
              hasTasks ? (
                <div className="space-y-2">
                  {group.tasks.map((task) => (
                    <TaskItem 
                      key={task.id} 
                      task={task} 
                      onToggle={onToggleTask}
                      onDelete={onDeleteTask}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground/50 text-sm font-sans">
                  No {group.title.toLowerCase()} tasks
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}