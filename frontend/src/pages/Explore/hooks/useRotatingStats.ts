import { useState, useEffect, useRef } from "react";

type StatsView = "category" | "energy" | "productivity" | "habits";

interface UseRotatingStatsProps {
  hasCategoryBalance: boolean;
  hasEnergyPatterns: boolean;
  hasProductivity: boolean;
  hasHabits: boolean;
}

export function useRotatingStats({
  hasCategoryBalance,
  hasEnergyPatterns,
  hasProductivity,
  hasHabits,
}: UseRotatingStatsProps) {
  const statsRotateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [statsSwipeStart, setStatsSwipeStart] = useState<number | null>(null);

  // Build available views array
  const availableViews: StatsView[] = [];
  if (hasCategoryBalance) availableViews.push("category");
  if (hasEnergyPatterns) availableViews.push("energy");
  if (hasProductivity) availableViews.push("productivity");
  if (hasHabits) availableViews.push("habits");

  // Initialize currentStatsView - use first available view, or category as fallback
  const [currentStatsView, setCurrentStatsView] = useState<StatsView>(() => {
    if (hasCategoryBalance) return "category";
    if (hasEnergyPatterns) return "energy";
    if (hasProductivity) return "productivity";
    if (hasHabits) return "habits";
    return "category"; // Fallback
  });

  // Update current view when available views change - this ensures we show the first available view
  useEffect(() => {
    if (availableViews.length > 0) {
      setCurrentStatsView((prev) => {
        // If current view is not available, switch to first available
        if (!availableViews.includes(prev)) {
          return availableViews[0];
        }
        return prev;
      });
    }
  }, [hasCategoryBalance, hasEnergyPatterns, hasProductivity, hasHabits]);

  // Auto-rotate stats view every 10 seconds
  useEffect(() => {
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
      }, 10000);
      
      return () => {
        if (statsRotateTimerRef.current) {
          clearInterval(statsRotateTimerRef.current);
        }
      };
    }
  }, [availableViews.length, currentStatsView, hasCategoryBalance, hasEnergyPatterns, hasProductivity, hasHabits]);

  const handleSwipeStart = (clientX: number) => {
    setStatsSwipeStart(clientX);
    if (statsRotateTimerRef.current) {
      clearInterval(statsRotateTimerRef.current);
    }
  };

  const handleSwipeEnd = (endX: number) => {
    if (statsSwipeStart === null) return;
    
    const diff = statsSwipeStart - endX;
    const threshold = 50;
    
    if (Math.abs(diff) > threshold && availableViews.length > 1) {
      const currentIndex = availableViews.indexOf(currentStatsView);
      if (currentIndex === -1) {
        setCurrentStatsView(availableViews[0]);
      } else if (diff > 0) {
        // Swipe left - next view (wrap around)
        const nextIndex = (currentIndex + 1) % availableViews.length;
        setCurrentStatsView(availableViews[nextIndex]);
      } else {
        // Swipe right - previous view (wrap around)
        const prevIndex = (currentIndex - 1 + availableViews.length) % availableViews.length;
        setCurrentStatsView(availableViews[prevIndex]);
      }
      
      // Restart auto-rotation timer after manual swipe
      if (statsRotateTimerRef.current) {
        clearInterval(statsRotateTimerRef.current);
      }
      statsRotateTimerRef.current = setInterval(() => {
        setCurrentStatsView((prev) => {
          const idx = availableViews.indexOf(prev);
          const nextIdx = (idx + 1) % availableViews.length;
          return availableViews[nextIdx];
        });
      }, 10000);
    }
    
    setStatsSwipeStart(null);
  };

  return {
    currentStatsView,
    setCurrentStatsView,
    availableViews,
    statsSwipeStart,
    handleSwipeStart,
    handleSwipeEnd,
  };
}
