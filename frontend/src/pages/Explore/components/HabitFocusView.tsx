import { Sparkles, Zap, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface HabitFocusViewProps {
  habitReinforcement: {
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
  };
}

export function HabitFocusView({ habitReinforcement }: HabitFocusViewProps) {
  const navigate = useNavigate();

  const handleSuggestionClick = (action: string) => {
    if (action === "schedule_checkin" || action === "restart_streak") {
      navigate("/");
    } else if (action === "plan_tasks" || action === "diversify_categories" || action === "adjust_load") {
      navigate("/calendar");
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
          This Week's Focus
        </h3>
      </div>

      {/* AI-Powered Encouragement */}
      {habitReinforcement.encouragement && (
        <div className="mb-6 p-5 bg-gradient-to-br from-primary/10 via-primary/5 to-primary/10 rounded-2xl border border-primary/20">
          <div className="flex items-start gap-3">
            <span className="text-3xl leading-none">{habitReinforcement.encouragement.emoji}</span>
            <div className="flex-1">
              <p className="text-sm font-sans text-foreground leading-relaxed font-medium">
                {habitReinforcement.encouragement.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Forward-Looking Predictions & Insights */}
      <div className="space-y-4">
        {/* Top 3 Actionable Suggestions */}
        {habitReinforcement.micro_suggestions && habitReinforcement.micro_suggestions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-sans font-medium text-muted-foreground uppercase">Your Next Moves</span>
            </div>
            <div className="space-y-2.5">
              {habitReinforcement.micro_suggestions.slice(0, 3).map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion.action)}
                  className={`w-full p-3.5 rounded-xl border text-left transition-all ${
                    suggestion.priority === "high"
                      ? "bg-primary/10 border-primary/30 hover:bg-primary/15 hover:border-primary/40"
                      : suggestion.priority === "medium"
                      ? "bg-primary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/30"
                      : "bg-background/50 border-primary/10 hover:bg-background/70 hover:border-primary/20"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-base mt-0.5">
                      {suggestion.priority === "high" ? "🎯" : suggestion.priority === "medium" ? "✨" : "💡"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-sans font-medium text-foreground mb-1">
                        {suggestion.title}
                      </div>
                      <div className="text-xs font-sans text-muted-foreground leading-relaxed">
                        {suggestion.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Predictive Focus Areas */}
        {habitReinforcement.risk_indicators && habitReinforcement.risk_indicators.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-sans font-medium text-muted-foreground uppercase">Watch This Week</span>
            </div>
            <div className="space-y-2">
              {habitReinforcement.risk_indicators.slice(0, 2).map((risk, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-xl border ${
                    risk.severity === "high"
                      ? "bg-amber-500/10 border-amber-500/30"
                      : risk.severity === "medium"
                      ? "bg-orange-500/10 border-orange-500/30"
                      : "bg-muted/50 border-border/50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm mt-0.5">
                      {risk.severity === "high" ? "⚠️" : risk.severity === "medium" ? "⚡" : "💡"}
                    </span>
                    <div className="flex-1">
                      <div className="text-xs font-sans font-medium text-foreground mb-1">
                        {risk.message}
                      </div>
                      {risk.context && (
                        <div className="text-xs font-sans text-muted-foreground">
                          {risk.context}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

