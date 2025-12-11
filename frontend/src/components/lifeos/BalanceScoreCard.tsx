import { Sparkles, Scale, Battery, Zap, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
type BalanceStatus = "low" | "optimal" | "heavy";
interface BalanceScoreCardProps {
  status?: BalanceStatus;
  tasksCompleted?: number;
  totalTasks?: number;
}
const statusConfig = {
  low: {
    label: "Space Available",
    subtitle: "Energy Status",
    description: "Room for deep work, learning, or rest.",
    className: "bg-balance-low",
    icon: Zap
  },
  optimal: {
    label: "Balanced Pacing",
    subtitle: "Energy Status",
    description: "You're in a great rhythm today.",
    className: "bg-balance-optimal",
    icon: Scale
  },
  heavy: {
    label: "Prioritize Rest",
    subtitle: "Energy Status",
    description: "Focus on essentials. Be gentle with yourself.",
    className: "bg-balance-heavy",
    icon: Heart
  }
};
export function BalanceScoreCard({
  status = "optimal",
  tasksCompleted = 0,
  totalTasks = 0
}: BalanceScoreCardProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const progress = totalTasks > 0 ? tasksCompleted / totalTasks * 100 : 0;
  return <div className="mx-4 animate-slide-up" style={{
    animationDelay: "0.2s"
  }}>
      <div className={cn("rounded-2xl p-5 shadow-card transition-all duration-300", config.className)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-foreground/60 text-sm font-sans font-medium">
              {config.subtitle}
            </p>
            <h2 className="text-foreground text-xl font-semibold mt-0.5 font-serif">
              {config.label}
            </h2>
          </div>
          <div className="w-12 h-12 rounded-full bg-foreground/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-foreground/80" />
          </div>
        </div>
        
        {/* Progress indicator */}
        {totalTasks > 0 && <div className="mt-4">
            <div className="flex justify-between text-xs font-sans text-foreground/60 mb-1">
              <span>{tasksCompleted} of {totalTasks} tasks</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-foreground/10 rounded-full overflow-hidden">
              <div className="h-full bg-foreground/40 rounded-full transition-all duration-500" style={{
            width: `${progress}%`
          }} />
            </div>
          </div>}
        
        <p className="text-foreground/70 text-sm font-sans mt-3">
          {config.description}
        </p>
      </div>
    </div>;
}