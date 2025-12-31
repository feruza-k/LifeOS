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
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
            Productivity Insights
          </h3>
        </div>
        <div className="text-center py-8 text-muted-foreground text-sm">
          Productivity data will appear as you complete tasks
        </div>
      </>
    );
  }
  
  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
          Productivity Insights
        </h3>
      </div>
      
      {/* Overall Completion - Large Visual Metric */}
      <div className="mb-6">
        <div className="flex items-center justify-center mb-3">
          <div className="relative" style={{ width: '128px', height: '128px' }}>
            <svg 
              className="transform -rotate-90" 
              viewBox="0 0 100 100"
              style={{ display: 'block', width: '100%', height: '100%' }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - (productivityInsights.completion_rate || 0))}`}
                className="transition-all duration-500"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ zIndex: 1 }}>
              <span className="text-2xl font-sans font-bold text-foreground">
                {Math.round(productivityInsights.completion_rate * 100)}%
              </span>
              <span className="text-xs font-sans text-muted-foreground mt-0.5">Completion</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Most Productive Day */}
        {productivityInsights.best_day && (
          <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-sans font-medium text-muted-foreground uppercase">Best Day</span>
            </div>
            <div className="text-lg font-sans font-bold text-foreground mb-0.5">
              {productivityInsights.best_day.day}
            </div>
            <div className="text-xs font-sans text-muted-foreground">
              {Math.round(productivityInsights.best_day.completion_rate * 100)}% completion
            </div>
          </div>
        )}
        
        {/* Check-in Frequency */}
        {consistency && (
          <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-sans font-medium text-muted-foreground uppercase">Check-ins</span>
            </div>
            <div className="text-lg font-sans font-bold text-foreground mb-0.5">
              {Math.round(consistency.consistency_rate * 100)}%
            </div>
            <div className="text-xs font-sans text-muted-foreground">
              {consistency.days_with_checkins}/{consistency.total_days} days
              {consistency.current_streak > 0 && (
                <span className="ml-1.5">🔥 {consistency.current_streak}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Peak Focus Times */}
      {productivityInsights.best_times.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-sans font-medium text-muted-foreground uppercase">Peak Focus Times</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {productivityInsights.best_times.map((time, index) => (
              <div
                key={index}
                className="px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20"
              >
                <span className="text-sm font-sans font-medium text-foreground">{time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

