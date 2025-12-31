import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Sparkles, TrendingUp, Layers, Heart, ArrowUp, ArrowDown, Calendar, Activity, Edit2, Zap, Target, Clock } from "lucide-react";
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
import { WeeklySummary } from "./Explore/components/WeeklySummary";
import { RotatingStats } from "./Explore/components/RotatingStats";
import { useExploreData } from "./Explore/hooks/useExploreData";

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
  const [showSetFocus, setShowSetFocus] = useState(false);
  const [currentGoalIndex, setCurrentGoalIndex] = useState(0);
  const [trendView, setTrendView] = useState<"weekly" | "monthly">("weekly");
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [displayedNote, setDisplayedNote] = useState<string>("");
  const carouselRef = useRef<HTMLDivElement>(null);
  const autoRotateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const photoRotateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const store = useLifeOSStore();
  const coreAI = useCoreAI();

  // Use custom hook for data fetching
  const {
    alignData,
    analyticsData,
    habitReinforcement,
    weeklyPhotos,
    weeklySummary,
    loading,
    reloadPhotos,
  } = useExploreData();

  // Get all goals from month_goals array, fallback to month_focus for backward compatibility
  const goals = useMemo(() => {
    if (!alignData) return [];
    return alignData.goals.month_goals && alignData.goals.month_goals.length > 0
      ? alignData.goals.month_goals
      : (alignData.goals.month_focus.title 
          ? [{
              title: alignData.goals.month_focus.title,
              description: alignData.goals.month_focus.description,
              progress: alignData.goals.month_focus.progress,
              id: "",
              order_index: 0
            }]
          : []);
  }, [alignData]);

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

  // Handle photo index changes from WeeklyPhotos component
  const handlePhotoIndexChange = (index: number) => {
    setCurrentPhotoIndex(index);
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
    
    // Calculate typing speed (reveal over 7 seconds, leaving 1s pause)
    const typingDuration = 7000; // 7 seconds - slower, more readable
    const totalChars = currentNote.length;
    const intervalTime = 50; // Update every 50ms for smoother, slower animation
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
  // Match rotation time to typing duration (7s typing + 1s pause = 8s total)
  useEffect(() => {
    if (weeklyPhotos.length > 1) {
      photoRotateTimerRef.current = setInterval(() => {
        setCurrentPhotoIndex((prev) => (prev + 1) % weeklyPhotos.length);
      }, 8000); // 8 seconds to match typing duration + pause
      
      return () => {
        if (photoRotateTimerRef.current) {
          clearInterval(photoRotateTimerRef.current);
        }
      };
    }
  }, [weeklyPhotos.length]);


  const handleSetFocus = async (goals: Array<{ title: string; description?: string }>) => {
    try {
      const currentMonth = format(new Date(), "yyyy-MM");
      await api.saveMonthlyGoals(currentMonth, goals);
      await reloadData(); // refresh to show new goals
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

      {/* Weekly Summary Card - Executive Overview with Photos & Reflections */}
      {alignData && alignData.week_stats && (
        <WeeklySummary
          weekStats={alignData.week_stats}
          consistency={analyticsData?.consistency || null}
          weeklyPhotos={weeklyPhotos}
          currentPhotoIndex={currentPhotoIndex}
          displayedNote={displayedNote}
          onPhotoIndexChange={handlePhotoIndexChange}
          onReloadPhotos={reloadPhotos}
        />
      )}


      {/* Suggestions from SolAI - MOVED TO TOP */}
      {alignData && alignData.nudge && (
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
      {analyticsData && ((trendView === "weekly" && analyticsData.weekly_trends && analyticsData.weekly_trends.length > 0) || (trendView === "monthly" && analyticsData.monthly_trends && analyticsData.monthly_trends.length > 0)) && (
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
              {analyticsData.monthly_trends && analyticsData.monthly_trends.length > 0 && (
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
                ? (analyticsData.weekly_trends || []).slice(-4)
                : (analyticsData.monthly_trends || []).slice(-6);
              const maxValue = trends.length > 0 ? Math.max(...trends.map(t => t.completion_rate), 1) : 1;
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

      {/* Debug: Always show something after Focus to verify rendering */}
      {alignData && (
        <div className="px-4 py-3">
          <div className="p-3 bg-muted/30 rounded-xl border border-border/30">
            <p className="text-xs text-muted-foreground font-sans text-center">
              Sections loading... (If you see this, rendering is working)
            </p>
          </div>
        </div>
      )}

      {/* Goal Progress - Task Connections */}
      {analyticsData && analyticsData.goal_task_connections && analyticsData.goal_task_connections.length > 0 && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.15s" }}>
          <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                Goal Progress
              </h3>
            </div>
            <div className="space-y-4">
              {analyticsData.goal_task_connections.map((connection) => (
                <div key={connection.goal_id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-sans font-medium text-foreground">
                      {connection.goal_title}
                    </h4>
                    <span className="text-xs text-muted-foreground font-sans">
                      {connection.total_matches} match{connection.total_matches !== 1 ? "es" : ""}
                    </span>
                  </div>
                  {connection.recent_tasks && connection.recent_tasks.length > 0 && (
                    <div className="space-y-1 pl-2 border-l-2 border-primary/20">
                      {connection.recent_tasks.slice(0, 3).map((task, idx) => (
                        <div key={idx} className="text-xs text-muted-foreground font-sans">
                          • {task.title}
                        </div>
                      ))}
                      {connection.recent_tasks.length > 3 && (
                        <div className="text-xs text-muted-foreground/60 font-sans italic">
                          +{connection.recent_tasks.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category distribution as proxy for value alignment */}
      {alignData && alignData.value_alignment && Object.keys(alignData.value_alignment).length > 0 && (
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

      {/* Simple progress line - Always show if alignData exists */}
      {alignData && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.25s" }}>
          <div className="p-4 bg-card rounded-2xl shadow-soft border border-border/50">
            <p className="text-sm text-foreground font-sans text-center">
              {alignData.progress || "Building your alignment insights..."}
            </p>
          </div>
        </div>
      )}




      {/* Rotating Stats: Category Balance, Energy Patterns, Productivity Insights */}
      {(analyticsData || habitReinforcement) && (
        <RotatingStats
          analyticsData={analyticsData}
          habitReinforcement={habitReinforcement}
        />
      )}

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
      {analyticsData && analyticsData.drift_analysis && analyticsData.drift_analysis.drift_indicators && Object.keys(analyticsData.drift_analysis.drift_indicators).length > 0 && (
        <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.45s" }}>
          <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50 border-amber-500/30">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                Drift Indicators
              </h3>
            </div>
            <div className="space-y-2">
              {Object.entries(analyticsData.drift_analysis?.drift_indicators || {}).map(([category, indicator]) => {
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
      {analyticsData && analyticsData.month_comparison && analyticsData.month_comparison.has_comparison && (
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


