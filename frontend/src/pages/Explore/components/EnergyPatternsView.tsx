import { Zap, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";

interface EnergyPatternsViewProps {
  energyPatterns: {
    weekly_patterns: Array<{
      week_start: string;
      week_end: string;
      energy_level: string;
      average_daily_load: number;
      average_completion_rate: number;
      average_energy_score: number;
    }>;
    trend: string;
    insights?: string[];
  };
}

export function EnergyPatternsView({ energyPatterns }: EnergyPatternsViewProps) {
  const currentWeek = energyPatterns.weekly_patterns[energyPatterns.weekly_patterns.length - 1];
  const energyColors = {
    "empty": "bg-muted",
    "very_light": "bg-emerald-200",
    "light": "bg-emerald-300",
    "balanced": "bg-emerald-400",
    "moderate": "bg-emerald-500",
    "heavy": "bg-emerald-600"
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
            Energy Load
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-sans">Past Month</span>
          {energyPatterns.trend && (
            <span className={`text-xs font-sans font-medium px-2 py-1 rounded ${
              energyPatterns.trend === "increasing" 
                ? "bg-emerald-500/20 text-emerald-600"
                : energyPatterns.trend === "decreasing"
                ? "bg-emerald-500/20 text-emerald-600"
                : "bg-muted text-muted-foreground"
            }`}>
              {energyPatterns.trend === "increasing" ? "↑ Increasing" :
               energyPatterns.trend === "decreasing" ? "↓ Decreasing" : "→ Stable"}
            </span>
          )}
        </div>
      </div>

      {/* Weekly Summary */}
      <div className="mb-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-sans font-bold text-foreground">{currentWeek.average_daily_load.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground font-sans uppercase mt-1">Avg Load</div>
          </div>
          <div>
            <div className="text-2xl font-sans font-bold text-foreground">{Math.round((currentWeek.average_completion_rate || 0) * 100)}%</div>
            <div className="text-xs text-muted-foreground font-sans uppercase mt-1">Completion</div>
          </div>
          <div>
            <div className="text-2xl font-sans font-bold text-foreground">{Math.round(currentWeek.average_energy_score || 0)}</div>
            <div className="text-xs text-muted-foreground font-sans uppercase mt-1">Energy</div>
          </div>
        </div>
      </div>
      
      {/* Weekly Trend Chart */}
      <div className="mb-4">
        <div className="flex items-end justify-between h-32 gap-1 mb-2">
          {energyPatterns.weekly_patterns.slice(-4).map((week, index) => {
            const maxLoad = Math.max(...energyPatterns.weekly_patterns.map(w => w.average_daily_load || 0), 1);
            const heightPercent = (week.average_daily_load / maxLoad) * 100;
            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: "100px" }}>
                  <div
                    className={`w-full rounded-t transition-all duration-500 ${energyColors[week.energy_level as keyof typeof energyColors] || "bg-muted"}`}
                    style={{ height: `${Math.max(heightPercent, 5)}%` }}
                    title={`${week.average_daily_load.toFixed(1)} tasks/day, ${(week.average_completion_rate * 100).toFixed(0)}% completion`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-sans text-center">
                  {format(parseISO(week.week_start), "MMM d")}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground font-sans">
          <span>Load (tasks/day)</span>
          <span>Completion: {currentWeek?.average_completion_rate ? 
            `${(currentWeek.average_completion_rate * 100).toFixed(0)}%` : "N/A"}</span>
        </div>
      </div>

      {/* Insights */}
      {energyPatterns.insights && energyPatterns.insights.length > 0 && (
        <div className="mt-auto pt-3 border-t border-border/50">
          <div className="space-y-2">
            {energyPatterns.insights.map((insight, index) => (
              <div key={index} className="flex items-start gap-2">
                <Sparkles className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-foreground font-sans leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

