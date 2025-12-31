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
        return api.getNote(dateStr).catch(() => null).then(note => ({ dateStr, note }));
      });
      
      const results = await Promise.all(datePromises);
      
      const photosWithNotes: Photo[] = [];
      
      for (const { dateStr, note } of results) {
        if (note) {
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
          const hasReflection = note.content && note.content.trim();
          
          // Include if there's at least a photo OR a reflection
          if (hasPhoto || hasReflection) {
            photosWithNotes.push({
              date: dateStr,
              filename: hasPhoto ? photoData.filename : '', // Empty if no photo
              url: hasPhoto ? api.getPhotoUrl(photoData.filename) : '',
              note: hasReflection ? note.content.trim() : undefined
            });
          }
        }
      }
      
      setWeeklyPhotos(photosWithNotes);
    } catch (error) {
      // Silently fail - photos are optional
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load main data and photos in parallel for faster loading
      const [summary, analytics, habitData, weeklySummaryData] = await Promise.all([
        api.getAlignSummary(),
        api.getAlignAnalytics().catch(() => null),
        api.getHabitReinforcement().catch(() => null),
        api.getWeeklyReflectionSummary().catch(() => null)
      ]);
      
      setAlignData(summary);
      setAnalyticsData(analytics);
      setHabitReinforcement(habitData);
      
      if (weeklySummaryData?.summary) {
        setWeeklySummary(weeklySummaryData.summary);
      }
      
      // Load photos in parallel (they're already optimized to load in parallel)
      await loadWeeklyPhotosAndReflections();
    } catch (error) {
      console.error("Failed to load align data:", error);
      toast.error("Failed to load alignment data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reload photos when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadWeeklyPhotosAndReflections();
      }
    };
    
    const handleFocus = () => {
      loadWeeklyPhotosAndReflections();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
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

