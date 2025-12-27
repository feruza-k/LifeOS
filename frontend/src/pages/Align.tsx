import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Target, MessageSquare, Sparkles, TrendingUp, Layers, Heart, ArrowUp, ArrowDown, Calendar, Activity } from "lucide-react";
import { format, parseISO } from "date-fns";
import { BottomNav } from "@/components/lifeos/BottomNav";
import { CoreAIFAB } from "@/components/lifeos/CoreAI/CoreAIFAB";
import { useLifeOSStore } from "@/hooks/useLifeOSStore";
import { useCoreAI } from "@/hooks/useCoreAI";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SetFocusModal } from "@/components/lifeos/SetFocusModal";
import { toast } from "sonner";

interface AlignData {
  direction: {
    narrative: string;
    has_data: boolean;
  };
  goals: {
    year_theme: string | null;
    month_focus: {
      title: string | null;
      description: string | null;
      progress: number | null;
      month: string;
    };
    week_intent: string | null;
  };
  patterns: string[];
  value_alignment: Record<string, { count: number; percentage: number }>;
  progress: string;
  nudge: {
    message: string;
    action: string;
  } | null;
  is_new_user: boolean;
  week_stats: {
    total_tasks: number;
    completed: number;
    total: number;
  };
}

interface AnalyticsData {
  weekly_trends: Array<{
    week_start: string;
    week_end: string;
    tasks_planned: number;
    tasks_completed: number;
    completion_rate: number;
    categories: Record<string, number>;
  }>;
  monthly_trends: Array<{
    month: string;
    tasks_planned: number;
    tasks_completed: number;
    completion_rate: number;
    categories: Record<string, number>;
  }>;
  week_comparison: {
    tasks_delta: number;
    completion_delta: number;
    completion_delta_percentage: number;
    category_shifts: Record<string, { current: number; previous: number; delta: number }>;
    has_comparison: boolean;
  };
  month_comparison: {
    tasks_delta: number;
    completion_delta: number;
    completion_delta_percentage: number;
    category_shifts: Record<string, { current: number; previous: number; delta: number }>;
    has_comparison: boolean;
  };
  category_trends: Record<string, Array<{ week: string; count: number }>>;
  drift_analysis: {
    drift_indicators: Record<string, {
      severity: string;
      completion_rate: number;
      postpone_rate: number;
      message: string;
    }>;
  };
  consistency: {
    checkin_frequency: number;
    days_with_checkins: number;
    total_days: number;
    consistency_rate: number;
    current_streak: number;
  };
  energy_patterns: {
    weekly_patterns: Array<{
      week_start: string;
      energy_level: string;
      average_daily_load: number;
    }>;
  };
  current_week: {
    total_tasks: number;
    week_start: string;
    week_end: string;
  };
  monthly_focus: {
    title: string | null;
    progress: number | null;
    month: string;
  };
}

const Align = () => {
  const [alignData, setAlignData] = useState<AlignData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetFocus, setShowSetFocus] = useState(false);
  const navigate = useNavigate();
  const store = useLifeOSStore();
  const coreAI = useCoreAI();

  useEffect(() => {
    loadAlignData();
  }, []);

  const loadAlignData = async () => {
    try {
      setLoading(true);
      const [summary, analytics] = await Promise.all([
        api.getAlignSummary(),
        api.getAlignAnalytics().catch(() => null) // Analytics is optional
      ]);
      setAlignData(summary);
      setAnalyticsData(analytics);
    } catch (error) {
      console.error("Failed to load align data:", error);
      toast.error("Failed to load alignment data");
    } finally {
      setLoading(false);
    }
  };

  const handleSetFocus = async (title: string, description?: string) => {
    try {
      const currentMonth = format(new Date(), "yyyy-MM");
      await api.saveMonthlyFocus({
        month: currentMonth,
        title,
        description: description || null,
      });
      await loadAlignData(); // refresh to show new focus
      toast.success("Monthly focus set");
    } catch (error) {
      toast.error("Failed to save monthly focus");
    }
  };

  // Quick helper to open AI chat with a message
  const handleDiscussWithAI = (message: string) => {
    coreAI.sendMessage(message);
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground font-sans">Loading alignment...</p>
        </div>
      </div>
    );
  }

  if (!alignData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-muted-foreground font-sans">Failed to load alignment data</p>
        </div>
      </div>
    );
  }

  // Show invitation for new users instead of empty state
  if (alignData.is_new_user) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <p className="text-xs font-sans font-medium text-muted-foreground tracking-widest uppercase text-center pt-4 pb-2">
          LifeOS, powered by SolAI
        </p>

        <header className="px-6 pb-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-serif font-medium text-foreground">Align</h1>
            </div>
            <Target className="w-7 h-7 text-primary" />
          </div>
          <p className="text-muted-foreground font-sans text-sm mt-2">
            Strategic reflection and alignment
          </p>
        </header>

        <div className="px-4 py-6 animate-slide-up">
          <div className="p-6 bg-card rounded-2xl shadow-soft border border-border/50">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-serif font-medium text-foreground mb-2">
                I see the space, but I don't know the direction yet.
              </h2>
              <p className="text-sm text-muted-foreground font-sans mb-6 leading-relaxed">
                Set a monthly focus, choose your values, or talk to SolAI to begin aligning your actions with what matters.
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => setShowSetFocus(true)}
                  className="w-full h-12 text-base font-sans font-medium"
                >
                  Set Monthly Focus
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDiscussWithAI("Help me set up my values and monthly focus")}
                  className="w-full h-12 text-base font-sans font-medium"
                >
                  Talk to SolAI
                </Button>
              </div>
            </div>
          </div>
        </div>

        <BottomNav />
        <CoreAIFAB
          messages={coreAI.messages}
          onSendMessage={coreAI.sendMessage}
          onConfirmAction={coreAI.confirmAction}
          isLoading={coreAI.isLoading}
          aiName={store.settings.coreAIName}
          onClearHistory={coreAI.clearHistory}
          currentView="align"
        />
        <SetFocusModal
          isOpen={showSetFocus}
          onClose={() => setShowSetFocus(false)}
          onSave={handleSetFocus}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <p className="text-xs font-sans font-medium text-muted-foreground tracking-widest uppercase text-center pt-4 pb-2">
        LifeOS, powered by SolAI
      </p>

      <header className="px-6 pb-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-serif font-medium text-foreground">Align</h1>
          </div>
          <Target className="w-7 h-7 text-primary" />
        </div>
        <p className="text-muted-foreground font-sans text-sm mt-2">
          Strategic reflection and alignment
        </p>
      </header>

      {/* Main direction narrative from SolAI */}
      <div className="px-4 py-3 animate-slide-up">
        <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-sans font-semibold text-foreground mb-2">Direction</h3>
              <p className="text-sm text-foreground font-sans leading-relaxed">
                {alignData.direction.narrative}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/week")}
              className="flex-1 text-sm font-sans"
            >
              Review this week
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDiscussWithAI("Help me understand my progress this week")}
              className="flex-1 text-sm font-sans"
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              Discuss with SolAI
            </Button>
          </div>
        </div>
      </div>

      {/* Monthly focus - show if set */}
      {alignData.goals.month_focus.title && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                Focus
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <h4 className="font-serif font-medium text-foreground text-base mb-1">
                  {alignData.goals.month_focus.title}
                </h4>
                {alignData.goals.month_focus.description && (
                  <p className="text-sm text-muted-foreground font-sans">
                    {alignData.goals.month_focus.description}
                  </p>
                )}
                {alignData.goals.month_focus.progress !== null && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground font-sans mb-1">
                      <span>Progress</span>
                      <span>{alignData.goals.month_focus.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${alignData.goals.month_focus.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSetFocus(true)}
              className="mt-3 text-xs font-sans text-muted-foreground"
            >
              Update focus
            </Button>
          </div>
        </div>
      )}

      {!alignData.goals.month_focus.title && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50 border-dashed">
            <div className="text-center">
              <p className="text-sm text-muted-foreground font-sans mb-3">
                No monthly focus set yet
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSetFocus(true)}
                className="text-sm font-sans"
              >
                Set Monthly Focus
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Patterns from analysis - only show if we have real insights */}
      {alignData.patterns.length > 0 && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.15s" }}>
          <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                Patterns
              </h3>
            </div>
            <div className="space-y-2">
              {alignData.patterns.map((pattern, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <p className="text-sm text-foreground font-sans flex-1">{pattern}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category distribution as proxy for value alignment */}
      {Object.keys(alignData.value_alignment).length > 0 && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                Value Alignment
              </h3>
            </div>
            <div className="space-y-2">
              {Object.entries(alignData.value_alignment)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([category, data]) => {
                  const categoryInfo = store.categories.find(c => c.id === category);
                  const label = categoryInfo?.label || category;
                  return (
                    <div key={category} className="flex items-center justify-between">
                      <span className="text-sm text-foreground font-sans">{label}</span>
                      <span className="text-xs text-muted-foreground font-sans">
                        {data.count} task{data.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  );
                })}
            </div>
            <p className="text-xs text-muted-foreground font-sans mt-3 italic">
              {(() => {
                // Find the category with most tasks
                const topCategory = Object.entries(alignData.value_alignment)
                  .sort((a, b) => b[1].count - a[1].count)[0];
                const categoryInfo = store.categories.find(c => c.id === topCategory[0]);
                const topLabel = categoryInfo?.label || topCategory[0];
                return `This week leaned toward ${topLabel}.`;
              })()}
            </p>
          </div>
        </div>
      )}

      {/* Simple progress line */}
      <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.25s" }}>
        <div className="p-4 bg-card rounded-2xl shadow-soft border border-border/50">
          <p className="text-sm text-foreground font-sans text-center">
            {alignData.progress}
          </p>
        </div>
      </div>

      {/* Analytics: Week-over-Week Comparison */}
      {analyticsData && analyticsData.week_comparison.has_comparison && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                This Week vs Last Week
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground font-sans">Tasks planned</span>
                <div className="flex items-center gap-2">
                  {analyticsData.week_comparison.tasks_delta !== 0 && (
                    analyticsData.week_comparison.tasks_delta > 0 ? (
                      <ArrowUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <ArrowDown className="w-4 h-4 text-muted-foreground" />
                    )
                  )}
                  <span className="text-sm font-sans font-medium text-foreground">
                    {analyticsData.week_comparison.tasks_delta > 0 ? "+" : ""}
                    {analyticsData.week_comparison.tasks_delta}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground font-sans">Completion rate</span>
                <div className="flex items-center gap-2">
                  {analyticsData.week_comparison.completion_delta !== 0 && (
                    analyticsData.week_comparison.completion_delta > 0 ? (
                      <ArrowUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <ArrowDown className="w-4 h-4 text-muted-foreground" />
                    )
                  )}
                  <span className="text-sm font-sans font-medium text-foreground">
                    {analyticsData.week_comparison.completion_delta > 0 ? "+" : ""}
                    {analyticsData.week_comparison.completion_delta_percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics: Completion Rate Trends */}
      {analyticsData && analyticsData.weekly_trends.length > 0 && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.35s" }}>
          <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                Completion Trends
              </h3>
            </div>
            <div className="space-y-2">
              {analyticsData.weekly_trends.slice(-4).map((week, index) => {
                const weekStart = parseISO(week.week_start);
                const completionRate = Math.round(week.completion_rate * 100);
                return (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-sans">
                      {format(weekStart, "MMM d")}
                    </span>
                    <div className="flex items-center gap-3 flex-1 mx-3">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                      <span className="text-xs font-sans font-medium text-foreground w-12 text-right">
                        {completionRate}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Analytics: Consistency Metrics */}
      {analyticsData && analyticsData.consistency.days_with_checkins > 0 && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.4s" }}>
          <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                Consistency
              </h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground font-sans">Days with check-ins</span>
                <span className="text-sm font-sans font-medium text-foreground">
                  {analyticsData.consistency.days_with_checkins} of {analyticsData.consistency.total_days}
                </span>
              </div>
              {analyticsData.consistency.current_streak > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground font-sans">Current streak</span>
                  <span className="text-sm font-sans font-medium text-foreground">
                    {analyticsData.consistency.current_streak} days
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Analytics: Category Drift Detection */}
      {analyticsData && Object.keys(analyticsData.drift_analysis.drift_indicators).length > 0 && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.45s" }}>
          <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50 border-amber-500/30">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                Drift Indicators
              </h3>
            </div>
            <div className="space-y-2">
              {Object.entries(analyticsData.drift_analysis.drift_indicators).map(([category, indicator]) => {
                const categoryInfo = store.categories.find(c => c.id === category);
                const label = categoryInfo?.label || category;
                return (
                  <div key={category} className="p-2 bg-amber-500/10 rounded-lg">
                    <p className="text-sm font-sans text-foreground">{indicator.message}</p>
                    <p className="text-xs text-muted-foreground font-sans mt-1">
                      Completion: {Math.round(indicator.completion_rate * 100)}% | Postponed: {Math.round(indicator.postpone_rate * 100)}%
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Analytics: Month-over-Month Comparison */}
      {analyticsData && analyticsData.month_comparison.has_comparison && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.5s" }}>
          <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                This Month vs Last Month
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground font-sans">Tasks planned</span>
                <div className="flex items-center gap-2">
                  {analyticsData.month_comparison.tasks_delta !== 0 && (
                    analyticsData.month_comparison.tasks_delta > 0 ? (
                      <ArrowUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <ArrowDown className="w-4 h-4 text-muted-foreground" />
                    )
                  )}
                  <span className="text-sm font-sans font-medium text-foreground">
                    {analyticsData.month_comparison.tasks_delta > 0 ? "+" : ""}
                    {analyticsData.month_comparison.tasks_delta}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground font-sans">Completion rate</span>
                <div className="flex items-center gap-2">
                  {analyticsData.month_comparison.completion_delta !== 0 && (
                    analyticsData.month_comparison.completion_delta > 0 ? (
                      <ArrowUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <ArrowDown className="w-4 h-4 text-muted-foreground" />
                    )
                  )}
                  <span className="text-sm font-sans font-medium text-foreground">
                    {analyticsData.month_comparison.completion_delta > 0 ? "+" : ""}
                    {analyticsData.month_comparison.completion_delta_percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single suggestion from SolAI */}
      {alignData.nudge && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <div className="p-5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-primary/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-sans font-semibold text-foreground mb-1">Suggestion</h4>
                <p className="text-sm text-foreground font-sans leading-relaxed mb-3">
                  {alignData.nudge.message}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDiscussWithAI(`Help me implement: ${alignData.nudge!.message}`)}
                    className="flex-1 text-sm font-sans"
                  >
                    Apply
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-sm font-sans"
                  >
                    Ignore
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
      <CoreAIFAB
        messages={coreAI.messages}
        onSendMessage={coreAI.sendMessage}
        onConfirmAction={coreAI.confirmAction}
        isLoading={coreAI.isLoading}
        aiName={store.settings.coreAIName}
        onClearHistory={coreAI.clearHistory}
        currentView="align"
      />
      <SetFocusModal
        isOpen={showSetFocus}
        onClose={() => setShowSetFocus(false)}
        onSave={handleSetFocus}
      />
    </div>
  );
};

export default Align;

