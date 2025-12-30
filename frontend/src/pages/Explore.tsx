import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Sparkles, TrendingUp, Layers, Heart, ArrowUp, ArrowDown, Calendar, Activity, Edit2, Image as ImageIcon, Zap, Target, Clock, ChevronRight, PieChart } from "lucide-react";
import { format, parseISO } from "date-fns";
import { BottomNav } from "@/components/lifeos/BottomNav";
import { CoreAIFAB } from "@/components/lifeos/CoreAI/CoreAIFAB";
import { QuickMenu } from "@/components/lifeos/QuickMenu";
import { useLifeOSStore } from "@/stores/useLifeOSStore";
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
    month_goals?: Array<{
      title: string;
      description: string | null;
      progress: number | null;
  id: string;
      order_index: number;
    }>;
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
      week_end: string;
      energy_level: string;
      average_daily_load: number;
      average_completion_rate: number;
      average_energy_score: number;
      days_tracked: number;
      total_tasks: number;
      completed_tasks: number;
    }>;
    daily_patterns?: Array<{
      date: string;
      day_name: string;
      total_tasks: number;
      completed_tasks: number;
      completion_rate: number;
      energy_level: string;
    }>;
    trend: string;
    insights?: string[];
  };
  category_balance?: {
    distribution: Record<string, number>;
    score: number;
    status: "balanced" | "moderate" | "imbalanced";
  };
  goal_task_connections?: Array<{
    goal_id: string;
    goal_title: string;
    recent_tasks: Array<{
  title: string;
      date: string;
      similarity: number;
    }>;
    total_matches: number;
  }>;
  productivity_insights?: {
    best_times: string[];
    best_day: {
      day: string;
      completion_rate: number;
    } | null;
    completion_rate: number;
  };
  upcoming_week_preview?: {
    week_start: string;
    week_end: string;
    total_tasks: number;
    load_by_day: Record<string, number>;
    heaviest_day: string | null;
  };
  quick_actions?: Array<{
    type: string;
    label: string;
    message: string;
    action: string;
    goal_id?: string;
  }>;
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

const Explore = () => {
  const [alignData, setAlignData] = useState<AlignData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetFocus, setShowSetFocus] = useState(false);
  const [currentGoalIndex, setCurrentGoalIndex] = useState(0);
  const [trendView, setTrendView] = useState<"weekly" | "monthly">("weekly");
  const [weeklyPhotos, setWeeklyPhotos] = useState<Array<{ date: string; filename: string; url: string; note?: string }>>([]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const autoRotateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const photoRotateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [displayedNote, setDisplayedNote] = useState<string>("");
  const [weeklySummary, setWeeklySummary] = useState<string>("");
  const [currentStatsView, setCurrentStatsView] = useState<"category" | "energy" | "productivity">("category");
  const statsRotateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const store = useLifeOSStore();
  const coreAI = useCoreAI();

  // Get all goals from month_goals array, fallback to month_focus for backward compatibility
  const goals = alignData?.goals.month_goals && alignData.goals.month_goals.length > 0
    ? alignData.goals.month_goals
    : (alignData?.goals.month_focus.title 
        ? [{
            title: alignData.goals.month_focus.title,
            description: alignData.goals.month_focus.description,
            progress: alignData.goals.month_focus.progress,
            id: "",
            order_index: 0
          }]
        : []);

  useEffect(() => {
    loadAlignData();
  }, []);

  // Auto-rotate carousel every 5 seconds
  useEffect(() => {
    if (goals.length > 1) {
      autoRotateTimerRef.current = setInterval(() => {
        setCurrentGoalIndex((prev) => (prev + 1) % goals.length);
      }, 5000);
      
      return () => {
        if (autoRotateTimerRef.current) {
          clearInterval(autoRotateTimerRef.current);
        }
      };
    }
  }, [goals.length]);

  // Handle swipe gestures
  useEffect(() => {
    if (!carouselRef.current || goals.length <= 1) return;

    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      isDragging = true;
      if (autoRotateTimerRef.current) {
        clearInterval(autoRotateTimerRef.current);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      currentX = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      
      const diff = startX - currentX;
      const threshold = 50; // Minimum swipe distance
      
      if (Math.abs(diff) > threshold) {
        if (diff > 0) {
          // Swipe left - next goal
          setCurrentGoalIndex((prev) => (prev + 1) % goals.length);
        } else {
          // Swipe right - previous goal
          setCurrentGoalIndex((prev) => (prev - 1 + goals.length) % goals.length);
        }
      }
      
      // Restart auto-rotate
      if (goals.length > 1) {
        autoRotateTimerRef.current = setInterval(() => {
          setCurrentGoalIndex((prev) => (prev + 1) % goals.length);
        }, 5000);
      }
    };

    const element = carouselRef.current;
    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchmove', handleTouchMove);
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [goals.length]);

  const loadAlignData = async () => {
    try {
      setLoading(true);
      const [summary, analytics] = await Promise.all([
        api.getAlignSummary(),
        api.getAlignAnalytics().catch(() => null) // Analytics is optional
      ]);
      setAlignData(summary);
      setAnalyticsData(analytics);
      
      // Load weekly photos and reflections
      await loadWeeklyPhotosAndReflections();
      // Load weekly summary
      try {
        const summary = await api.getWeeklyReflectionSummary();
        if (summary?.summary) {
          setWeeklySummary(summary.summary);
        }
      } catch (error) {
        console.error("Failed to load weekly summary:", error);
      }
    } catch (error) {
      console.error("Failed to load align data:", error);
      toast.error("Failed to load alignment data");
    } finally {
      setLoading(false);
    }
  };

  const loadWeeklyPhotosAndReflections = async () => {
    try {
      // Get dates for this week
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      
      const photosWithNotes: Array<{ date: string; filename: string; url: string; note?: string }> = [];
      
      // Load notes for each day of the week
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dateStr = format(date, "yyyy-MM-dd");
        
        try {
          const note = await api.getNote(dateStr);
          if (note) {
            // Only include if there's a photo
            if (note.photo && note.photo.filename) {
              photosWithNotes.push({
                date: dateStr,
                filename: note.photo.filename,
                url: `${import.meta.env.VITE_API_URL || 'https://api.mylifeos.dev'}/photos/${note.photo.filename}`,
                note: note.content && note.content.trim() ? note.content.trim() : undefined
              });
            }
          }
        } catch (error) {
          // Note doesn't exist for this day, skip
        }
      }
      
      setWeeklyPhotos(photosWithNotes);
    } catch (error) {
      console.error("Failed to load weekly photos and reflections:", error);
    }
  };

  // Typing animation effect for notes
  useEffect(() => {
    const currentNote = weeklyPhotos[currentPhotoIndex]?.note || "";
    
    // Clear any existing typing animation
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
    }
    
    // Reset displayed note
    setDisplayedNote("");
    
    if (!currentNote) {
      return;
    }
    
    // Calculate typing speed (reveal over 4.5 seconds, leaving 0.5s pause)
    const typingDuration = 4500; // 4.5 seconds
    const totalChars = currentNote.length;
    const intervalTime = 30; // Update every 30ms for smooth animation
    const charsPerInterval = Math.max(1, Math.ceil((totalChars * intervalTime) / typingDuration));
    
    let currentCharIndex = 0;
    
    typingTimerRef.current = setInterval(() => {
      if (currentCharIndex < totalChars) {
        setDisplayedNote(currentNote.substring(0, currentCharIndex + charsPerInterval));
        currentCharIndex += charsPerInterval;
      } else {
        setDisplayedNote(currentNote);
        if (typingTimerRef.current) {
          clearInterval(typingTimerRef.current);
        }
      }
    }, intervalTime);
    
    return () => {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
      }
    };
  }, [currentPhotoIndex, weeklyPhotos]);

  // Auto-rotate photos if there are multiple
  useEffect(() => {
    if (weeklyPhotos.length > 1) {
      photoRotateTimerRef.current = setInterval(() => {
        setCurrentPhotoIndex((prev) => (prev + 1) % weeklyPhotos.length);
      }, 5000);
      
      return () => {
        if (photoRotateTimerRef.current) {
          clearInterval(photoRotateTimerRef.current);
        }
      };
    }
  }, [weeklyPhotos.length]);

  // Auto-rotate stats view every 10 seconds
  useEffect(() => {
    const hasCategoryBalance = analyticsData?.category_balance && analyticsData.category_balance.distribution && Object.keys(analyticsData.category_balance.distribution).length > 0;
    const hasEnergyPatterns = analyticsData?.energy_patterns && analyticsData.energy_patterns.weekly_patterns.length > 0;
    const hasProductivity = analyticsData?.productivity_insights;
    
    const availableViews: Array<"category" | "energy" | "productivity"> = [];
    if (hasCategoryBalance) availableViews.push("category");
    if (hasEnergyPatterns) availableViews.push("energy");
    if (hasProductivity) availableViews.push("productivity");
    
    if (availableViews.length > 1) {
      // Set initial view to first available
      if (!availableViews.includes(currentStatsView)) {
        setCurrentStatsView(availableViews[0]);
      }
      
      statsRotateTimerRef.current = setInterval(() => {
        setCurrentStatsView((prev) => {
          const currentIndex = availableViews.indexOf(prev);
          const nextIndex = (currentIndex + 1) % availableViews.length;
          return availableViews[nextIndex];
        });
      }, 10000); // 10 seconds
      
      return () => {
        if (statsRotateTimerRef.current) {
          clearInterval(statsRotateTimerRef.current);
        }
      };
    }
  }, [analyticsData, currentStatsView]);

  const handleSetFocus = async (goals: Array<{ title: string; description?: string }>) => {
    try {
      const currentMonth = format(new Date(), "yyyy-MM");
      await api.saveMonthlyGoals(currentMonth, goals);
      await loadAlignData(); // refresh to show new goals
      toast.success(`Saved ${goals.length} goal${goals.length !== 1 ? "s" : ""}`);
    } catch (error) {
      toast.error("Failed to save monthly goals");
    }
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
              <h1 className="text-lg font-sans font-bold text-foreground">Explore</h1>
            </div>
            <Compass className="w-7 h-7 text-primary" />
          </div>
          <p className="text-muted-foreground font-sans text-sm mt-2">
            Strategic reflection and alignment
          </p>
        </header>

        <div className="px-4 py-6 animate-slide-up">
          <div className="p-6 bg-card rounded-2xl shadow-soft border border-border/50">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Compass className="w-8 h-8 text-primary" />
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
          currentView="explore"
        />
        <SetFocusModal
          isOpen={showSetFocus}
          onClose={() => setShowSetFocus(false)}
          onSave={handleSetFocus}
          existingGoals={goals}
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
            <h1 className="text-lg font-sans font-bold text-foreground">Explore</h1>
          </div>
          <div className="flex items-center gap-3">
            <Compass className="w-7 h-7 text-primary" />
            <QuickMenu />
          </div>
        </div>
        <p className="text-muted-foreground font-sans text-sm mt-2">
          Strategic reflection and alignment
        </p>
      </header>

      {/* Weekly Summary Card - Executive Overview */}
      {alignData && alignData.week_stats && (
      <div className="px-4 py-3 animate-slide-up">
          <div className="p-5 bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border border-primary/20">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                This Week
              </h3>
              </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-sans font-bold text-foreground mb-1">
                  {alignData.week_stats.completed || 0}
            </div>
                <div className="text-xs text-muted-foreground font-sans uppercase">Completed</div>
        </div>
              <div className="text-center">
                <div className="text-2xl font-sans font-bold text-foreground mb-1">
                  {alignData.week_stats.total || 0}
      </div>
                <div className="text-xs text-muted-foreground font-sans uppercase">Total Tasks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-sans font-bold text-foreground mb-1">
                  {alignData.week_stats.total > 0 
                    ? Math.round((alignData.week_stats.completed / alignData.week_stats.total) * 100)
                    : 0}%
                </div>
                <div className="text-xs text-muted-foreground font-sans uppercase">Rate</div>
              </div>
            </div>
            {analyticsData && analyticsData.consistency && analyticsData.consistency.current_streak > 0 && (
              <div className="mt-4 pt-4 border-t border-primary/20 flex items-center justify-center gap-2">
                <span className="text-sm font-sans text-foreground">🔥</span>
                <span className="text-sm font-sans font-medium text-foreground">
                  {analyticsData.consistency.current_streak} day streak
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suggestions from SolAI - MOVED TO TOP */}
      {alignData.nudge && (
        <div className="px-4 py-3 animate-slide-up">
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
                    onClick={() => navigate("/week")}
                    className="flex-1 text-sm font-sans"
                  >
                    Review Week
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-sm font-sans"
                  >
                    Dismiss
                  </Button>
            </div>
          </div>
        </div>
      </div>
        </div>
      )}

      {/* Analytics: Completion Rate Trends */}
      {analyticsData && ((trendView === "weekly" && analyticsData.weekly_trends.length > 0) || (trendView === "monthly" && analyticsData.monthly_trends.length > 0)) && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.05s" }}>
          <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                  Completion Trends
                </h3>
              </div>
              {/* Toggle between weekly and monthly */}
              {analyticsData.monthly_trends.length > 0 && (
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
                    onClick={() => setTrendView("weekly")}
                    className={`px-2 py-1 text-xs font-sans rounded transition-colors ${
                      trendView === "weekly"
                        ? "bg-background text-foreground font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setTrendView("monthly")}
                    className={`px-2 py-1 text-xs font-sans rounded transition-colors ${
                      trendView === "monthly"
                        ? "bg-background text-foreground font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    Monthly
                  </button>
              </div>
              )}
              </div>
            {/* Line Chart Visualization */}
            {(() => {
              const trends = trendView === "weekly" 
                ? analyticsData.weekly_trends.slice(-4)
                : analyticsData.monthly_trends.slice(-6);
              const maxValue = Math.max(...trends.map(t => t.completion_rate), 1);
              const width = 300;
              const height = 100;
              const step = trends.length > 1 ? width / (trends.length - 1) : width;
              
              return (
                <>
                  <div className="relative h-32 mb-4">
                    <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                      {/* Grid lines */}
                      <defs>
                        <linearGradient id="completionGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {[0, 25, 50, 75, 100].map((y) => (
                        <line
                          key={y}
                          x1="0"
                          y1={100 - y}
                          x2="300"
                          y2={100 - y}
                          stroke="hsl(var(--muted-foreground))"
                          strokeWidth="0.5"
                          strokeOpacity="0.2"
                        />
                      ))}
                      {/* Area under curve */}
                      <path
                        d={(() => {
                          let path = `M 0 ${height}`;
                          trends.forEach((point, index) => {
                            const x = index * step;
                            const y = height - (point.completion_rate / maxValue) * height;
                            path += index === 0 ? ` L ${x} ${y}` : ` L ${x} ${y}`;
                          });
                          path += ` L ${width} ${height} Z`;
                          return path;
                        })()}
                        fill="url(#completionGradient)"
                      />
                      {/* Line */}
                      <polyline
                        points={trends.map((point, index) => {
                          const x = index * step;
                          const y = height - (point.completion_rate / maxValue) * height;
                          return `${x},${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Data points */}
                      {trends.map((point, index) => {
                        const x = index * step;
                        const y = height - (point.completion_rate / maxValue) * height;
                        return (
                          <circle
                            key={index}
                            cx={x}
                            cy={y}
                            r="3.5"
                            fill="hsl(var(--primary))"
                            stroke="hsl(var(--background))"
                            strokeWidth="2"
                          />
                        );
                      })}
                    </svg>
        </div>
                  {/* Labels and values */}
                  <div className="flex justify-between items-end text-xs">
                    {trends.map((point, index) => {
                      const dateStr = trendView === "weekly" ? point.week_start : point.month;
                      const date = trendView === "weekly" 
                        ? parseISO(dateStr)
                        : parseISO(`${dateStr}-01`);
                      const completionRate = Math.round(point.completion_rate * 100);
                      const label = trendView === "weekly"
                        ? format(date, "MMM d")
                        : format(date, "MMM");
                      return (
                        <div key={index} className="flex flex-col items-center gap-1">
                          <span className="text-muted-foreground font-sans">
                            {label}
                          </span>
                          <span className="font-sans font-medium text-foreground">
                            {completionRate}%
                          </span>
      </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Goals Carousel */}
      {goals.length > 0 ? (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="relative p-5 bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                  Focus {goals.length > 1 && `(${currentGoalIndex + 1}/${goals.length})`}
            </h3>
          </div>
              <button
                onClick={() => setShowSetFocus(true)}
                className="p-1.5 rounded-full hover:bg-muted transition-colors"
                aria-label="Edit focus"
              >
                <Edit2 className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

            {/* Carousel Container */}
            <div 
              ref={carouselRef}
              className="relative overflow-hidden"
            >
              <div 
                className="flex transition-transform duration-500 ease-in-out"
                style={{ 
                  transform: `translateX(-${currentGoalIndex * 100}%)`,
                }}
              >
                {goals.map((goal, index) => (
                  <div
                    key={index}
                    className="w-full flex-shrink-0 px-1"
                  >
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-sans font-medium text-foreground text-base mb-1">
                          {goal.title}
                        </h4>
                        {goal.description && (
                          <p className="text-sm text-muted-foreground font-sans">
                            {goal.description}
                          </p>
                        )}
                        {goal.progress !== null && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-muted-foreground font-sans mb-1">
                              <span>Progress</span>
                              <span>{goal.progress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{ width: `${goal.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Controls - Only dots, no arrows */}
            {goals.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-4">
                {goals.map((_, index) => (
            <button
                    key={index}
                    onClick={() => {
                      setCurrentGoalIndex(index);
                      if (autoRotateTimerRef.current) {
                        clearInterval(autoRotateTimerRef.current);
                      }
                      autoRotateTimerRef.current = setInterval(() => {
                        setCurrentGoalIndex((prev) => (prev + 1) % goals.length);
                      }, 5000);
                    }}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      index === currentGoalIndex
                        ? "w-6 bg-primary"
                        : "w-1.5 bg-muted-foreground/30"
                    }`}
                    aria-label={`Go to goal ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
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


      {/* Weekly Photos & Reflections Widget */}
      {weeklyPhotos.length > 0 && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                This Week
              </h3>
            </div>
            <div className="grid gap-4 grid-cols-2">
              {/* Photo Album */}
              <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                {weeklyPhotos[currentPhotoIndex] && (
                  <img
                    src={weeklyPhotos[currentPhotoIndex].url}
                    alt="Weekly photo"
                    className="w-full h-full object-cover"
                  />
                )}
                {weeklyPhotos.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                    {weeklyPhotos.map((_, index) => (
                      <div
                        key={index}
                        className={`h-1 rounded-full transition-all ${
                          index === currentPhotoIndex ? "w-4 bg-white" : "w-1 bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
              {/* Reflection Note - centered, rotates with photo */}
              <div className="relative aspect-square flex items-center justify-center">
                {weeklyPhotos[currentPhotoIndex]?.note ? (
                  <p className="text-sm text-foreground font-sans italic leading-relaxed text-center px-2">
                    {displayedNote}
                    {displayedNote.length < (weeklyPhotos[currentPhotoIndex]?.note?.length || 0) && (
                      <span className="inline-block w-0.5 h-4 bg-foreground ml-0.5 animate-pulse" />
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground font-sans italic leading-relaxed text-center px-2">
                    No reflection for this moment
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {analyticsData && analyticsData.quick_actions && analyticsData.quick_actions.length > 0 && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.25s" }}>
          <div className="p-5 bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border border-primary/20">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                Quick Actions
              </h3>
            </div>
            <div className="space-y-2">
              {analyticsData.quick_actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (action.action === "schedule_category" || action.action === "schedule_goal_task") {
                      navigate("/calendar");
                    } else if (action.action === "review_schedule") {
                      navigate("/week");
                    }
                  }}
                  className="w-full p-3 bg-background/50 rounded-xl border border-primary/20 hover:bg-primary/10 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                <div className="flex-1">
                      <p className="text-sm font-sans font-medium text-foreground mb-1">
                        {action.label}
                      </p>
                      <p className="text-xs text-muted-foreground font-sans">
                        {action.message}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground ml-2" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rotating Stats: Category Balance, Energy Patterns, Productivity Insights */}
      {(() => {
        const hasCategoryBalance = analyticsData?.category_balance?.distribution && Object.keys(analyticsData.category_balance.distribution).length > 0;
        const hasEnergyPatterns = analyticsData?.energy_patterns?.weekly_patterns && analyticsData.energy_patterns.weekly_patterns.length > 0;
        const hasProductivity = analyticsData?.productivity_insights;
        const hasAnyStats = hasCategoryBalance || hasEnergyPatterns || hasProductivity;
        
        if (!hasAnyStats) return null;
        
        return (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50">
            {/* Category Balance View */}
            {currentStatsView === "category" && analyticsData.category_balance && analyticsData.category_balance.distribution && Object.keys(analyticsData.category_balance.distribution).length > 0 && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                      Category Balance
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-sans font-medium px-2 py-1 rounded ${
                      analyticsData.category_balance.status === "balanced" 
                        ? "bg-primary/20 text-primary" 
                        : analyticsData.category_balance.status === "imbalanced"
                        ? "bg-amber-500/20 text-amber-600"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {analyticsData.category_balance.status === "balanced" ? "Balanced" : 
                       analyticsData.category_balance.status === "imbalanced" ? "Imbalanced" : "Moderate"}
                    </span>
                  </div>
                </div>
            
            {/* Pie Chart Visualization */}
            <div className="mb-6 flex items-center justify-center">
              <div className="relative">
                <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
                  {(() => {
                    const entries = Object.entries(analyticsData.category_balance.distribution)
                      .sort((a, b) => b[1] - a[1]);
                    const total = Object.values(analyticsData.category_balance.distribution).reduce((a, b) => a + b, 0);
                    let currentAngle = 0;
                    const radius = 85;
                    const centerX = 100;
                    const centerY = 100;
                    const gap = 2; // Gap between segments in degrees
                    
                    return entries.map(([categoryId, count], index) => {
                      const categoryInfo = store.categories.find(c => c.id === categoryId);
                      const percentage = (count / total) * 100;
                      const angle = (percentage / 100) * 360;
                      const startAngle = currentAngle + (gap / 2);
                      const endAngle = currentAngle + angle - (gap / 2);
                      currentAngle += angle;
                      
                      // Calculate arc path
                      const startRad = (startAngle * Math.PI) / 180;
                      const endRad = (endAngle * Math.PI) / 180;
                      const x1 = centerX + radius * Math.cos(startRad);
                      const y1 = centerY + radius * Math.sin(startRad);
                      const x2 = centerX + radius * Math.cos(endRad);
                      const y2 = centerY + radius * Math.sin(endRad);
                      const largeArcFlag = angle > 180 ? 1 : 0;
                      
                      const pathData = [
                        `M ${centerX} ${centerY}`,
                        `L ${x1} ${y1}`,
                        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                        'Z'
                      ].join(' ');
                      
                      return (
                        <path
                          key={categoryId}
                          d={pathData}
                          fill={categoryInfo?.color || "hsl(var(--primary))"}
                          stroke="hsl(var(--background))"
                          strokeWidth="3"
                          className="transition-all duration-300 hover:opacity-80"
                        />
                      );
                    });
                  })()}
                </svg>
                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-sans font-bold text-foreground">
                    {Math.round(analyticsData.category_balance.score * 100)}%
                  </span>
                  <span className="text-xs font-sans text-muted-foreground mt-0.5">
                    Balance
                  </span>
                </div>
              </div>
            </div>
            
                {/* Category Distribution List */}
                <div className="space-y-3">
                  {Object.entries(analyticsData.category_balance.distribution)
                    .sort((a, b) => b[1] - a[1])
                    .map(([categoryId, count]) => {
                      const categoryInfo = store.categories.find(c => c.id === categoryId);
                      const label = categoryInfo?.label || categoryId;
                      const total = Object.values(analyticsData.category_balance.distribution).reduce((a, b) => a + b, 0);
                      const percentage = (count / total) * 100;
                      return (
                        <div key={categoryId} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                                style={{ backgroundColor: categoryInfo?.color || "hsl(var(--primary))" }}
                              />
                              <span className="text-sm text-foreground font-sans font-medium">{label}</span>
                            </div>
                            <span className="text-xs text-muted-foreground font-sans">{Math.round(percentage)}%</span>
                          </div>
                          <div className="w-full h-2 bg-muted/50 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500 shadow-sm"
                              style={{ 
                                width: `${percentage}%`,
                                backgroundColor: categoryInfo?.color || "hsl(var(--primary))"
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}

            {/* Energy/Load Patterns View */}
            {currentStatsView === "energy" && analyticsData.energy_patterns && analyticsData.energy_patterns.weekly_patterns.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                      Energy & Load Patterns
                    </h3>
                  </div>
                  {analyticsData.energy_patterns.trend && (
                    <span className={`text-xs font-sans font-medium px-2 py-1 rounded ${
                      analyticsData.energy_patterns.trend === "increasing" 
                        ? "bg-amber-500/20 text-amber-600"
                        : analyticsData.energy_patterns.trend === "decreasing"
                        ? "bg-emerald-500/20 text-emerald-600"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {analyticsData.energy_patterns.trend === "increasing" ? "↑ Increasing" :
                       analyticsData.energy_patterns.trend === "decreasing" ? "↓ Decreasing" : "→ Stable"}
                    </span>
                  )}
                </div>
            
            {/* Weekly Summary - Moved Above Trend Chart */}
            {analyticsData.energy_patterns.weekly_patterns.length > 0 && (() => {
              const currentWeek = analyticsData.energy_patterns.weekly_patterns[analyticsData.energy_patterns.weekly_patterns.length - 1];
              return (
                <div className="mb-6">
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
              );
            })()}
            
            {/* Weekly Trend Chart */}
            <div className="mb-6">
              <div className="flex items-end justify-between h-32 gap-1 mb-2">
                {analyticsData.energy_patterns.weekly_patterns.slice(-4).map((week, index) => {
                  const maxLoad = Math.max(...analyticsData.energy_patterns.weekly_patterns.map(w => w.average_daily_load || 0), 1);
                  const heightPercent = (week.average_daily_load / maxLoad) * 100;
                  // Aesthetic green colors for weekly bars
                  const energyColors = {
                    "empty": "bg-muted",
                    "very_light": "bg-emerald-300",
                    "light": "bg-emerald-400",
                    "balanced": "bg-emerald-500",
                    "moderate": "bg-emerald-600",
                    "heavy": "bg-emerald-700"
                  };
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
                <span>Completion: {analyticsData.energy_patterns.weekly_patterns[analyticsData.energy_patterns.weekly_patterns.length - 1]?.average_completion_rate ? 
                  `${(analyticsData.energy_patterns.weekly_patterns[analyticsData.energy_patterns.weekly_patterns.length - 1].average_completion_rate * 100).toFixed(0)}%` : "N/A"}</span>
              </div>
            </div>

            {/* Daily Breakdown for Current Week - Using Today Screen Colors */}
            {analyticsData.energy_patterns.daily_patterns && analyticsData.energy_patterns.daily_patterns.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-sans font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  This Week
                </h4>
                <div className="grid grid-cols-7 gap-1">
                  {analyticsData.energy_patterns.daily_patterns.map((day, index) => {
                    // Map energy levels to Today screen balance colors
                    const getBalanceColor = (energyLevel: string) => {
                      if (energyLevel === "empty" || energyLevel === "very_light" || energyLevel === "light") {
                        return "bg-balance-low";
                      } else if (energyLevel === "balanced" || energyLevel === "moderate") {
                        return "bg-balance-optimal";
                      } else if (energyLevel === "heavy") {
                        return "bg-balance-heavy";
                      }
                      return "bg-muted/20";
                    };
                    return (
                      <div key={index} className="flex flex-col items-center gap-1">
                        <div className={`w-full aspect-square rounded ${getBalanceColor(day.energy_level)} flex flex-col items-center justify-center`}>
                          <span className="text-[10px] font-sans font-medium text-foreground">{day.total_tasks}</span>
                          {day.completion_rate > 0 && (
                            <span className="text-[8px] font-sans text-muted-foreground">{Math.round(day.completion_rate * 100)}%</span>
                          )}
                        </div>
                        <span className="text-[9px] text-muted-foreground font-sans">{day.day_name.slice(0, 3)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

                {/* Insights */}
                {analyticsData.energy_patterns.insights && analyticsData.energy_patterns.insights.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="space-y-2">
                      {analyticsData.energy_patterns.insights.map((insight, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <Sparkles className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-foreground font-sans leading-relaxed">{insight}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Productivity Insights View */}
            {currentStatsView === "productivity" && analyticsData.productivity_insights && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                    Productivity Insights
                  </h3>
                </div>
                <div className="space-y-3">
              {analyticsData.productivity_insights.best_times.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground font-sans">Peak focus times</span>
                  <span className="text-sm font-sans font-medium text-foreground">
                    {analyticsData.productivity_insights.best_times.join(", ")}
                  </span>
                </div>
              )}
              {analyticsData.productivity_insights.best_day && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground font-sans">Most productive day</span>
                  <span className="text-sm font-sans font-medium text-foreground">
                    {analyticsData.productivity_insights.best_day.day} ({Math.round(analyticsData.productivity_insights.best_day.completion_rate * 100)}%)
                  </span>
                </div>
              )}
              {analyticsData.consistency && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground font-sans">Check-in frequency</span>
                    <span className="text-sm font-sans font-medium text-foreground">
                      {Math.round(analyticsData.consistency.consistency_rate * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${analyticsData.consistency.consistency_rate * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-sans">
                    <span>{analyticsData.consistency.days_with_checkins} of {analyticsData.consistency.total_days} days</span>
                    {analyticsData.consistency.current_streak > 0 && (
                      <span className="font-medium text-foreground">
                        🔥 {analyticsData.consistency.current_streak} day streak
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground font-sans">Overall completion</span>
                  <span className="text-sm font-sans font-medium text-foreground">
                    {Math.round(analyticsData.productivity_insights.completion_rate * 100)}%
                  </span>
                </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${analyticsData.productivity_insights.completion_rate * 100}%` }}
                    />
                  </div>
                </div>
                </div>
              </>
            )}

            {/* Navigation dots for rotating stats */}
            {(() => {
              const availableViews: Array<"category" | "energy" | "productivity"> = [];
              if (analyticsData.category_balance && analyticsData.category_balance.distribution && Object.keys(analyticsData.category_balance.distribution).length > 0) {
                availableViews.push("category");
              }
              if (analyticsData.energy_patterns && analyticsData.energy_patterns.weekly_patterns.length > 0) {
                availableViews.push("energy");
              }
              if (analyticsData.productivity_insights) {
                availableViews.push("productivity");
              }
              
              if (availableViews.length > 1) {
                return (
                  <div className="flex items-center justify-center gap-1.5 mt-4 pt-4 border-t border-border/50">
                    {availableViews.map((view) => (
                      <button
                        key={view}
                        onClick={() => {
                          setCurrentStatsView(view);
                          if (statsRotateTimerRef.current) {
                            clearInterval(statsRotateTimerRef.current);
                          }
                          statsRotateTimerRef.current = setInterval(() => {
                            setCurrentStatsView((prev) => {
                              const currentIndex = availableViews.indexOf(prev);
                              const nextIndex = (currentIndex + 1) % availableViews.length;
                              return availableViews[nextIndex];
                            });
                          }, 10000);
                        }}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          view === currentStatsView
                            ? "w-6 bg-primary"
                            : "w-1.5 bg-muted-foreground/30"
                        }`}
                        aria-label={`View ${view}`}
                      />
                    ))}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
        );
      })()}

      {/* Upcoming Week Preview */}
      {analyticsData && analyticsData.upcoming_week_preview && analyticsData.upcoming_week_preview.total_tasks > 0 && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.5s" }}>
          <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                  Next Week
                </h3>
              </div>
              <button
                onClick={() => navigate("/calendar")}
                className="text-xs text-primary font-sans hover:underline"
              >
                View
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground font-sans">Total tasks</span>
                <span className="text-sm font-sans font-medium text-foreground">
                  {analyticsData.upcoming_week_preview.total_tasks}
                </span>
              </div>
              {analyticsData.upcoming_week_preview.heaviest_day && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground font-sans">Heaviest day</span>
                  <span className="text-sm font-sans font-medium text-foreground">
                    {analyticsData.upcoming_week_preview.heaviest_day} ({analyticsData.upcoming_week_preview.load_by_day[analyticsData.upcoming_week_preview.heaviest_day]} tasks)
                  </span>
                </div>
              )}
              {Object.keys(analyticsData.upcoming_week_preview.load_by_day).length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground font-sans mb-2">Daily breakdown:</p>
                  <div className="space-y-1">
                    {Object.entries(analyticsData.upcoming_week_preview.load_by_day)
                      .sort((a, b) => b[1] - a[1])
                      .map(([day, count]) => (
                        <div key={day} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground font-sans">{day}</span>
                          <span className="text-foreground font-sans font-medium">{count} tasks</span>
              </div>
            ))}
          </div>
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

      <BottomNav />
      <CoreAIFAB
        messages={coreAI.messages}
        onSendMessage={coreAI.sendMessage}
        onConfirmAction={coreAI.confirmAction}
        isLoading={coreAI.isLoading}
        aiName={store.settings.coreAIName}
        onClearHistory={coreAI.clearHistory}
        currentView="explore"
      />
        <SetFocusModal
          isOpen={showSetFocus}
          onClose={() => setShowSetFocus(false)}
          onSave={handleSetFocus}
          existingGoals={goals}
      />
    </div>
  );
}

export default Explore;

