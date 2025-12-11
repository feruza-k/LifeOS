import { Target, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { MonthlyFocus } from "@/types/lifeos";

interface MonthlyFocusBannerProps {
  focus: MonthlyFocus | null;
  onSetFocus?: () => void;
}

export function MonthlyFocusBanner({ focus, onSetFocus }: MonthlyFocusBannerProps) {
  const currentMonth = format(new Date(), "MMMM");

  if (!focus) {
    return (
      <button
        onClick={onSetFocus}
        className="mx-4 mt-4 p-4 rounded-2xl bg-accent/50 border-2 border-dashed border-primary/30 flex items-center gap-3 transition-all hover:border-primary/50 hover:bg-accent/70 animate-slide-up"
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Target className="w-5 h-5 text-primary" />
        </div>
        <div className="text-left">
          <p className="text-sm font-sans font-medium text-foreground">
            Set your {currentMonth} focus
          </p>
          <p className="text-xs font-sans text-muted-foreground">
            What's one thing you want to master this month?
          </p>
        </div>
      </button>
    );
  }

  return (
    <div 
      className="mx-4 mt-4 p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-accent to-primary/5 border border-primary/20 animate-slide-up"
      style={{ animationDelay: "0.1s" }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-sans font-medium text-primary uppercase tracking-wide">
            {currentMonth} Focus
          </p>
          <h3 className="text-base font-serif font-semibold text-foreground mt-0.5 truncate">
            {focus.title}
          </h3>
          {focus.description && (
            <p className="text-sm text-muted-foreground font-sans mt-1 line-clamp-2">
              {focus.description}
            </p>
          )}
          {focus.progress !== undefined && focus.progress > 0 && (
            <div className="mt-2">
              <div className="h-1.5 bg-primary/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${focus.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
