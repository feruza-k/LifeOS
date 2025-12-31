import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { toast } from "sonner";

// Import api.getPhotoUrl for photo URL construction

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
  weekly_trends?: Array<{
    week_start: string;
    week_end: string;
    tasks_planned: number;
    tasks_completed: number;
    completion_rate: number;
    categories: Record<string, number>;
  }>;
  monthly_trends?: Array<{
    month: string;
    tasks_planned: number;
    tasks_completed: number;
    completion_rate: number;
    categories: Record<string, number>;
  }>;
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
    current_streak: number;
    consistency_rate: number;
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

interface Photo {
  date: string;
  filename: string; // Can be empty if no photo
  url: string; // Can be empty if no photo
  note?: string; // Can be undefined if no reflection
}

export function useExploreData() {
  const [alignData, setAlignData] = useState<AlignData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [habitReinforcement, setHabitReinforcement] = useState<HabitReinforcement | null>(null);
  const [weeklyPhotos, setWeeklyPhotos] = useState<Photo[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const loadWeeklyPhotosAndReflections = async () => {
    try {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      // Load all notes in parallel instead of sequentially
      const datePromises = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dateStr = format(date, "yyyy-MM-dd");
        // Add cache-busting to ensure fresh data
        return api.getNote(dateStr).catch(() => null).then(note => ({ dateStr, note }));
      });
      
      const results = await Promise.all(datePromises);
      
      const photosWithNotes: Photo[] = [];
      
      for (const { dateStr, note } of results) {
        if (note) {
          // Check if content exists and is not empty (after trimming)
          const content = note.content;
          const trimmedContent = content ? String(content).trim() : '';
          const hasReflection = trimmedContent.length > 0;
          
          // Debug logging
          if (import.meta.env.DEV) {
            console.log(`[Explore] Note for ${dateStr}:`, {
              hasNote: !!note,
              content: content ? `"${content.substring(0, 50)}..."` : 'null/undefined',
              trimmedLength: trimmedContent.length,
              hasReflection
            });
          }
          
          // Only process if there's a non-empty reflection
          if (!hasReflection) {
            // Skip notes with empty or no content
            continue;
          }
          
          let photoData = null;
          // Check for photo in new format first
          if (note.photo && typeof note.photo === 'object' && note.photo.filename) {
            photoData = note.photo;
          } 
          // Fallback to old photos array format
          else if (note.photos && Array.isArray(note.photos) && note.photos.length > 0) {
            photoData = note.photos[0];
          }
          
          const hasPhoto = photoData && photoData.filename;
          
          // Include this note with reflection
          photosWithNotes.push({
            date: dateStr,
            filename: hasPhoto ? photoData.filename : '', // Empty if no photo
            url: hasPhoto ? api.getPhotoUrl(photoData.filename) : '',
            note: trimmedContent // Always include the reflection text
          });
        }
      }
      
      if (import.meta.env.DEV) {
        console.log(`[Explore] Loaded ${photosWithNotes.length} photos with reflections:`, 
          photosWithNotes.map(p => ({ date: p.date, hasNote: !!p.note, noteLength: p.note?.length || 0 }))
        );
      }
      
      setWeeklyPhotos(photosWithNotes);
    } catch (error) {
      console.error('[Explore] Error loading weekly photos:', error);
      // Silently fail - photos are optional
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load main data first - show page as soon as this is ready
      const [summary, analytics, habitData, weeklySummaryData] = await Promise.all([
        api.getAlignSummary(),
        api.getAlignAnalytics().catch((error) => {
          console.error('[useExploreData] Failed to load analytics:', error);
          return null;
        }),
        api.getHabitReinforcement().catch((error) => {
          console.error('[useExploreData] Failed to load habit reinforcement:', error);
          return null;
        }),
        api.getWeeklyReflectionSummary().catch((error) => {
          console.error('[useExploreData] Failed to load weekly summary:', error);
          return null;
        })
      ]);
      
      setAlignData(summary);
      setAnalyticsData(analytics);
      setHabitReinforcement(habitData);
      
      // Debug: Log analytics data structure
      if (import.meta.env.DEV) {
        console.log('[useExploreData] Analytics data received:', {
          hasData: !!analytics,
          keys: analytics ? Object.keys(analytics) : [],
          categoryBalance: analytics?.category_balance,
          energyPatterns: analytics?.energy_patterns,
          productivityInsights: analytics?.productivity_insights,
          fullData: analytics
        });
      }
      
      if (weeklySummaryData?.summary) {
        setWeeklySummary(weeklySummaryData.summary);
      }
      
      // Stop loading state immediately - show page content
      setLoading(false);
      
      // Load photos in background (non-blocking)
      loadWeeklyPhotosAndReflections().catch(() => {
        // Silently fail - photos are optional
      });
    } catch (error) {
      console.error("Failed to load align data:", error);
      toast.error("Failed to load alignment data");
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reload photos when page becomes visible or periodically when visible
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout | null = null;
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Reload immediately when page becomes visible
        loadWeeklyPhotosAndReflections();
        
        // Set up periodic refresh every 30 seconds when page is visible
        refreshInterval = setInterval(() => {
          loadWeeklyPhotosAndReflections();
        }, 30000); // Refresh every 30 seconds
      } else {
        // Clear interval when page is hidden
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
      }
    };
    
    const handleFocus = () => {
      loadWeeklyPhotosAndReflections();
    };
    
    // Initial setup - if page is already visible, start periodic refresh
    if (!document.hidden) {
      refreshInterval = setInterval(() => {
        loadWeeklyPhotosAndReflections();
      }, 30000);
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  const reloadData = async () => {
    await loadData();
  };

  return {
    alignData,
    analyticsData,
    habitReinforcement,
    weeklyPhotos,
    weeklySummary,
    loading,
    reloadPhotos: loadWeeklyPhotosAndReflections,
    reloadData,
  };
}

