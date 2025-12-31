import { TrendingUp, Calendar, Activity, Clock } from "lucide-react";

interface ProductivityInsightsViewProps {
  productivityInsights: {
    best_times: string[];
    best_day: {
      day: string;
      completion_rate: number;
    } | null;
    completion_rate: number;
  };
  consistency?: {
    consistency_rate: number;
    days_with_checkins: number;
    total_days: number;
    current_streak: number;
  } | null;
}

export function ProductivityInsightsView({ productivityInsights, consistency }: ProductivityInsightsViewProps) {
  // Safety check - if completion_rate is not available, show placeholder
  if (!productivityInsights || productivityInsights.completion_rate === undefined || productivityInsights.completion_rate === null) {
    return (
      <>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
              Productivity
            </h3>
          </div>
          <span className="text-xs text-muted-foreground font-sans">Past Month</span>
        </div>
        <div className="text-center py-8 text-muted-foreground text-sm">
          Productivity data will appear as you complete tasks
        </div>
      </>
    );
  }
  
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
            Productivity
          </h3>
        </div>
        <span className="text-xs text-muted-foreground font-sans">Past Month</span>
      </div>

      {/* Summary Stats - Match EnergyPatternsView style */}
      <div className="mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-sans font-bold text-foreground">
              {Math.round(productivityInsights.completion_rate * 100)}%
            </div>
            <div className="text-xs text-muted-foreground font-sans uppercase mt-1">Completion</div>
          </div>
          <div>
            <div className="text-2xl font-sans font-bold text-foreground">
              {productivityInsights.best_day ? productivityInsights.best_day.day : "—"}
            </div>
            <div className="text-xs text-muted-foreground font-sans uppercase mt-1">Best Day</div>
          </div>
          <div>
            <div className="text-2xl font-sans font-bold text-foreground">
              {consistency ? Math.round(consistency.consistency_rate * 100) : 0}%
            </div>
            <div className="text-xs text-muted-foreground font-sans uppercase mt-1">Check-ins</div>
          </div>
        </div>
      </div>

      {/* Metrics Grid - Consistent card style for all three */}
      <div className="mb-6">
        <div className="grid grid-cols-3 gap-3">
          {/* Completion Rate */}
          <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-sans font-medium text-muted-foreground uppercase">Completion</span>
            </div>
            <div className="text-lg font-sans font-bold text-foreground mb-0.5">
              {Math.round(productivityInsights.completion_rate * 100)}%
            </div>
            <div className="text-[10px] font-sans text-muted-foreground">
              Past month
            </div>
          </div>

          {/* Best Day */}
          {productivityInsights.best_day ? (
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-sans font-medium text-muted-foreground uppercase">Best Day</span>
              </div>
              <div className="text-lg font-sans font-bold text-foreground mb-0.5">
                {productivityInsights.best_day.day}
              </div>
              <div className="text-[10px] font-sans text-muted-foreground">
                {Math.round(productivityInsights.best_day.completion_rate * 100)}% completion
              </div>
            </div>
          ) : (
            <div className="p-3 bg-muted/30 rounded-xl border border-border/50">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-sans font-medium text-muted-foreground uppercase">Best Day</span>
              </div>
              <div className="text-lg font-sans font-bold text-muted-foreground mb-0.5">
                —
              </div>
              <div className="text-[10px] font-sans text-muted-foreground">
                No data
              </div>
            </div>
          )}
          
          {/* Check-ins */}
          {consistency ? (
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Activity className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-sans font-medium text-muted-foreground uppercase">Check-ins</span>
              </div>
              <div className="text-lg font-sans font-bold text-foreground mb-0.5">
                {Math.round(consistency.consistency_rate * 100)}%
              </div>
              <div className="text-[10px] font-sans text-muted-foreground">
                {consistency.days_with_checkins}/{consistency.total_days} days
              </div>
            </div>
          ) : (
            <div className="p-3 bg-muted/30 rounded-xl border border-border/50">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Activity className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-sans font-medium text-muted-foreground uppercase">Check-ins</span>
              </div>
              <div className="text-lg font-sans font-bold text-muted-foreground mb-0.5">
                —
              </div>
              <div className="text-[10px] font-sans text-muted-foreground">
                No data
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Peak Focus Times - Consistent card style */}
      {productivityInsights.best_times.length > 0 && (
        <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-sans font-medium text-muted-foreground uppercase">Peak Focus Times</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {productivityInsights.best_times.slice(0, 3).map((time, index) => (
              <div
                key={index}
                className="px-2 py-1 bg-primary/10 rounded-lg border border-primary/20"
              >
                <span className="text-xs font-sans font-medium text-foreground">{time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

