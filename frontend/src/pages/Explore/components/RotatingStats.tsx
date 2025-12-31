import { useRef } from "react";
import { CategoryBalanceView } from "./CategoryBalanceView";
import { EnergyPatternsView } from "./EnergyPatternsView";
import { ProductivityInsightsView } from "./ProductivityInsightsView";
import { useRotatingStats } from "../hooks/useRotatingStats";

interface AnalyticsData {
  category_balance?: {
    distribution: Record<string, number>;
    score: number;
    status: "balanced" | "moderate" | "imbalanced";
  };
  energy_patterns?: {
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
  productivity_insights?: {
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
  };
}

interface HabitReinforcement {
  micro_suggestions?: Array<{
    action: string;
    title: string;
    description: string;
    priority: string;
  }>;
  encouragement?: {
    message: string;
    emoji: string;
  };
  risk_indicators?: Array<{
    message: string;
    severity: string;
    context?: string;
  }>;
}

interface RotatingStatsProps {
  analyticsData: AnalyticsData | null;
  habitReinforcement: HabitReinforcement | null;
}

export function RotatingStats({ analyticsData, habitReinforcement }: RotatingStatsProps) {
  const statsCarouselRef = useRef<HTMLDivElement>(null);

  // More lenient checks - allow data even if some fields are missing
  const hasCategoryBalance = analyticsData?.category_balance && 
    analyticsData.category_balance.distribution &&
    typeof analyticsData.category_balance.distribution === 'object' &&
    Object.keys(analyticsData.category_balance.distribution).length > 0 &&
    Object.values(analyticsData.category_balance.distribution).some((v: any) => v > 0);
  
  const hasEnergyPatterns = analyticsData?.energy_patterns && 
    analyticsData.energy_patterns.weekly_patterns &&
    Array.isArray(analyticsData.energy_patterns.weekly_patterns) &&
    analyticsData.energy_patterns.weekly_patterns.length > 0;
  
  const hasProductivity = analyticsData?.productivity_insights && 
    (analyticsData.productivity_insights.completion_rate !== undefined ||
     analyticsData.productivity_insights.best_times?.length > 0 ||
     analyticsData.productivity_insights.best_day !== null);

  const {
    currentStatsView,
    setCurrentStatsView,
    availableViews,
    statsSwipeStart,
    handleSwipeStart,
    handleSwipeEnd,
  } = useRotatingStats({
    hasCategoryBalance,
    hasEnergyPatterns,
    hasProductivity,
    hasHabits: false, // Removed habits from carousel
  });

  const hasAnyStats = hasCategoryBalance || hasEnergyPatterns || hasProductivity;
  
  // Debug: Log what data is available
  if (import.meta.env.DEV) {
    console.log('[RotatingStats] Data check:', {
      hasCategoryBalance,
      hasEnergyPatterns,
      hasProductivity,
      hasAnyStats,
      categoryBalance: analyticsData?.category_balance,
      energyPatterns: analyticsData?.energy_patterns,
      productivityInsights: analyticsData?.productivity_insights,
      currentStatsView,
      availableViews,
      analyticsData: analyticsData ? Object.keys(analyticsData) : null,
      fullAnalyticsData: analyticsData
    });
  }

  if (!hasAnyStats) {
    // Show a placeholder instead of returning null
    return (
      <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.3s" }}>
        <div className="p-5 bg-card rounded-2xl shadow-soft border border-border/50">
          <div className="text-center py-8 text-muted-foreground text-sm">
            Analytics data will appear here as you use LifeOS
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.3s" }}>
      <div 
        ref={statsCarouselRef}
        className="p-5 bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden relative touch-pan-y"
        onTouchStart={(e) => {
          handleSwipeStart(e.touches[0].clientX);
        }}
        onTouchMove={(e) => {
          if (statsSwipeStart !== null) {
            e.preventDefault();
          }
        }}
        onTouchEnd={(e) => {
          if (statsSwipeStart === null) return;
          const endX = e.changedTouches[0].clientX;
          handleSwipeEnd(endX);
        }}
      >
        {/* Determine which view to actually render */}
        {(() => {
          // Use current view if available, otherwise use first available
          const viewToRender = availableViews.includes(currentStatsView) 
            ? currentStatsView 
            : (availableViews.length > 0 ? availableViews[0] : null);
          
          if (!viewToRender) return null;
          
          // Render the determined view
          if (viewToRender === "category" && hasCategoryBalance && analyticsData?.category_balance) {
            return (
              <CategoryBalanceView 
                categoryBalance={analyticsData.category_balance} 
                key={`category-${JSON.stringify(analyticsData.category_balance.distribution)}`}
              />
            );
          }
          
          if (viewToRender === "energy" && hasEnergyPatterns && analyticsData?.energy_patterns) {
            return (
              <EnergyPatternsView 
                energyPatterns={analyticsData.energy_patterns}
                key={`energy-${analyticsData.energy_patterns.weekly_patterns.length}`}
              />
            );
          }
          
          if (viewToRender === "productivity" && hasProductivity && analyticsData?.productivity_insights) {
            return (
              <ProductivityInsightsView 
                productivityInsights={analyticsData.productivity_insights}
                consistency={analyticsData.consistency || null}
                key={`productivity-${analyticsData.productivity_insights.completion_rate}`}
              />
            );
          }
          
          return null;
        })()}

        {/* Navigation dots - Always show if there are multiple views */}
        {availableViews.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-4 pt-4 border-t border-border/50">
            {availableViews.map((view) => (
              <button
                key={view}
                onClick={() => {
                  if (import.meta.env.DEV) {
                    console.log('[RotatingStats] Switching to view:', view);
                  }
                  setCurrentStatsView(view);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  view === currentStatsView
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-muted-foreground/30"
                }`}
                aria-label={`View ${view}`}
                title={`Switch to ${view} view`}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

