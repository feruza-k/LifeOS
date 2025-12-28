import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadStatus = "optimal" | "heavy" | "light" | "recovery";

interface LoadStatusCardProps {
  status?: LoadStatus;
}

const statusConfig = {
  optimal: {
    label: "Optimal Flow",
    description: "You're in the zone. Perfect balance today.",
    className: "bg-primary",
  },
  heavy: {
    label: "Heavy Load",
    description: "Consider delegating or rescheduling.",
    className: "bg-destructive/90",
  },
  light: {
    label: "Light Day",
    description: "Room for deep work or rest.",
    className: "bg-tag-social",
  },
  recovery: {
    label: "Recovery Mode",
    description: "Focus on essentials. Be gentle.",
    className: "bg-muted-foreground",
  },
};

export function LoadStatusCard({ status = "optimal" }: LoadStatusCardProps) {
  const config = statusConfig[status];

  return (
    <div 
      className="mx-4 animate-slide-up" 
      style={{ animationDelay: "0.2s" }}
    >
      <div className={cn(
        "rounded-2xl p-5 shadow-card transition-all duration-300",
        config.className
      )}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-primary-foreground/70 text-sm font-sans font-medium">
              Load Status
            </p>
            <h2 className="text-primary-foreground text-xl font-serif font-semibold mt-0.5">
              {config.label}
            </h2>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
        </div>
        <p className="text-primary-foreground/80 text-sm font-sans mt-3">
          {config.description}
        </p>
      </div>
    </div>
  );
}
