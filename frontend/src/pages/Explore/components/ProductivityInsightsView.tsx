import { TrendingUp, Calendar, Activity, Clock, Target } from "lucide-react";

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
  
  const completionRate = Math.round(productivityInsights.completion_rate * 100);
  const checkInRate = consistency ? Math.round(consistency.consistency_rate * 100) : 0;
  
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

      {/* Main Completion Rate - Large Circular Progress */}
      <div className="mb-6 flex items-center justify-center">
        <div className="relative" style={{ width: '140px', height: '140px' }}>
          <svg 
            className="transform -rotate-90" 
            viewBox="0 0 100 100"
            style={{ display: 'block', width: '100%', height: '100%' }}
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="6"
              opacity="0.2"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - productivityInsights.completion_rate)}`}
              className="transition-all duration-700 ease-out"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-sans font-bold text-foreground">
              {completionRate}%
            </span>
            <span className="text-xs font-sans text-muted-foreground mt-0.5">Completion</span>
          </div>
        </div>
      </div>

      {/* Key Metrics - Two Column Layout */}
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-3">
          {/* Best Day */}
          <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-primary/20 rounded-lg">
                <Calendar className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-[10px] font-sans font-medium text-muted-foreground uppercase">Best Day</span>
            </div>
            {productivityInsights.best_day ? (
              <>
                <div className="text-xl font-sans font-bold text-foreground mb-1">
                  {productivityInsights.best_day.day}
                </div>
                <div className="text-xs font-sans text-muted-foreground">
                  {Math.round(productivityInsights.best_day.completion_rate * 100)}% completion
                </div>
              </>
            ) : (
              <div className="text-lg font-sans font-medium text-muted-foreground">
                No data yet
              </div>
            )}
          </div>

          {/* Check-ins */}
          <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-primary/20 rounded-lg">
                <Activity className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-[10px] font-sans font-medium text-muted-foreground uppercase">Check-ins</span>
            </div>
            {consistency ? (
              <>
                <div className="text-xl font-sans font-bold text-foreground mb-1">
                  {checkInRate}%
                </div>
                <div className="text-xs font-sans text-muted-foreground">
                  {consistency.days_with_checkins}/{consistency.total_days} days
                </div>
              </>
            ) : (
              <div className="text-lg font-sans font-medium text-muted-foreground">
                No data yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Peak Focus Times - Visual Timeline */}
      {productivityInsights.best_times.length > 0 && (
        <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-primary/20 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-[10px] font-sans font-medium text-muted-foreground uppercase">Peak Focus Times</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {productivityInsights.best_times.slice(0, 4).map((time, index) => (
              <div
                key={index}
                className="px-3 py-1.5 bg-primary/15 rounded-lg border border-primary/25 backdrop-blur-sm"
              >
                <span className="text-sm font-sans font-semibold text-foreground">{time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

