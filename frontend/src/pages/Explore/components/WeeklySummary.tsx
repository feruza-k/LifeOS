import { Activity } from "lucide-react";
import { format, parseISO } from "date-fns";
import { WeeklyPhotos } from "./WeeklyPhotos";

interface WeekStats {
  completed: number;
  total: number;
}

interface Consistency {
  current_streak: number;
}

interface WeeklySummaryProps {
  weekStats: WeekStats;
  consistency?: Consistency | null;
  weeklyPhotos: Array<{ date: string; filename: string; url: string; note?: string }>;
  currentPhotoIndex: number;
  displayedNote: string;
  onPhotoIndexChange: (index: number) => void;
  onReloadPhotos: () => void;
}

export function WeeklySummary({
  weekStats,
  consistency,
  weeklyPhotos,
  currentPhotoIndex,
  displayedNote,
  onPhotoIndexChange,
  onReloadPhotos,
}: WeeklySummaryProps) {
  const completionRate = weekStats.total > 0 
    ? Math.round((weekStats.completed / weekStats.total) * 100)
    : 0;

  return (
    <div className="px-4 py-3 animate-slide-up">
      <div className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
            This Week
          </h3>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center">
            <div className="text-xl font-sans font-bold text-foreground mb-0.5">
              {weekStats.completed || 0}
            </div>
            <div className="text-[10px] text-muted-foreground font-sans uppercase">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-sans font-bold text-foreground mb-0.5">
              {weekStats.total || 0}
            </div>
            <div className="text-[10px] text-muted-foreground font-sans uppercase">Total Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-sans font-bold text-foreground mb-0.5">
              {completionRate}%
            </div>
            <div className="text-[10px] text-muted-foreground font-sans uppercase">Rate</div>
          </div>
        </div>
        
        {weeklyPhotos.length > 0 && (
          <div className="mt-3 pt-3 border-t border-primary/20">
            <WeeklyPhotos
              photos={weeklyPhotos}
              currentIndex={currentPhotoIndex}
              displayedNote={displayedNote}
              onIndexChange={onPhotoIndexChange}
              onReload={onReloadPhotos}
            />
          </div>
        )}
      </div>
    </div>
  );
}

