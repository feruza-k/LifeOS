import { useState } from "react";
import { 
  Target, 
  Lightbulb, 
  BookOpen, 
  Compass, 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
  Heart, 
  Brain,
  Flame,
  Calendar,
  Award,
  BarChart3,
  Zap
} from "lucide-react";
import { BottomNav } from "@/components/lifeos/BottomNav";
import { CoreAIFAB } from "@/components/lifeos/CoreAI/CoreAIFAB";
import { ValueTag, ValueType } from "@/components/lifeos/ValueTag";
import { useLifeOSStore } from "@/hooks/useLifeOSStore";
import { useCoreAI } from "@/hooks/useCoreAI";
import { cn } from "@/lib/utils";

interface Goal {
  id: string;
  title: string;
  description: string;
  progress: number;
  value: ValueType;
  streak?: number;
}

const goals: Goal[] = [
  {
    id: "1",
    title: "Run a marathon",
    description: "Build endurance through consistent training",
    progress: 65,
    value: "health",
    streak: 12,
  },
  {
    id: "2",
    title: "Learn Spanish",
    description: "30 minutes of practice daily",
    progress: 40,
    value: "growth",
    streak: 7,
  },
  {
    id: "3",
    title: "Quality family time",
    description: "Weekly family activities",
    progress: 80,
    value: "family",
    streak: 4,
  },
  {
    id: "4",
    title: "Creative writing",
    description: "Complete short story collection",
    progress: 25,
    value: "creativity",
  },
  {
    id: "5",
    title: "Deep work sessions",
    description: "4 hours of focused work daily",
    progress: 55,
    value: "work",
    streak: 3,
  },
];

const Explore = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const store = useLifeOSStore();
  const coreAI = useCoreAI();

  // Calculate real stats
  const totalTasks = store.tasks.length;
  const completedTasks = store.tasks.filter(t => t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const thisWeekTasks = store.tasks.filter(t => {
    const taskDate = new Date(t.date);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return taskDate >= weekAgo;
  });
  const thisWeekCompleted = thisWeekTasks.filter(t => t.completed).length;

  const categories = [
    { id: "all", label: "All" },
    { id: "health", label: "Health" },
    { id: "growth", label: "Growth" },
    { id: "family", label: "Family" },
    { id: "work", label: "Work" },
    { id: "creativity", label: "Creative" },
  ];

  const filteredGoals = selectedCategory === "all" 
    ? goals 
    : goals.filter(g => g.value === selectedCategory);

  const insights = [
    {
      icon: Flame,
      title: "Hot Streak",
      value: "12 days",
      description: "Your longest active streak",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      icon: TrendingUp,
      title: "This Week",
      value: `${thisWeekCompleted} tasks`,
      description: "Completed in the last 7 days",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      icon: BarChart3,
      title: "Completion",
      value: `${completionRate}%`,
      description: "Overall task completion rate",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
  ];

  const quickActions = [
    { icon: Brain, label: "AI Insights", description: "Get personalized suggestions" },
    { icon: Calendar, label: "Weekly Review", description: "Reflect on your progress" },
    { icon: Award, label: "Achievements", description: "View your milestones" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Top Brand */}
      <p className="text-xs font-sans font-medium text-muted-foreground tracking-widest uppercase text-center pt-4 pb-2">
        LifeOS, powered by SolAI
      </p>

      {/* Header */}
      <header className="px-6 pb-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-medium text-foreground">
              Explore
            </h1>
          </div>
          <Compass className="w-7 h-7 text-primary" />
        </div>
        <p className="text-muted-foreground font-sans text-sm mt-2">
          Your goals, values, and progress at a glance.
        </p>
      </header>

      {/* Stats Grid */}
      <div className="px-4 py-3 animate-slide-up">
        <div className="grid grid-cols-3 gap-3">
          {insights.map((stat, index) => (
            <div 
              key={index}
              className="p-4 bg-card rounded-2xl shadow-soft text-center"
            >
              <div className={cn("w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center", stat.bgColor)}>
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
              <p className="text-lg font-serif font-semibold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground font-sans">{stat.title}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights Banner */}
      <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.1s" }}>
        <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-sans font-semibold text-foreground">SolAI Insight</h4>
              <p className="text-sm text-muted-foreground font-sans mt-1 leading-relaxed">
                Your most productive hours are between 9-11 AM. Consider scheduling deep work tasks during this time window.
              </p>
              <button className="text-sm text-primary font-sans font-medium mt-2 flex items-center gap-1 hover:underline">
                Get more insights <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3 animate-slide-up" style={{ animationDelay: "0.15s" }}>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {quickActions.map((action, index) => (
            <button
              key={index}
              className="flex-shrink-0 p-3 bg-card rounded-xl shadow-soft flex items-center gap-3 hover:bg-accent/50 transition-colors min-w-[160px]"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <action.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-sans font-medium text-foreground">{action.label}</p>
                <p className="text-xs text-muted-foreground font-sans">{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Goals Section */}
      <div className="px-4 py-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
              Your Goals
            </h3>
          </div>
          <button className="text-sm text-primary font-sans font-medium flex items-center gap-1 hover:underline">
            Add <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-sans font-medium whitespace-nowrap transition-all duration-200",
                selectedCategory === cat.id 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-card text-foreground shadow-soft hover:bg-accent"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Goals List */}
        <div className="space-y-3">
          {filteredGoals.map((goal) => (
            <div 
              key={goal.id}
              className="p-4 bg-card rounded-2xl shadow-soft"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-sans font-semibold text-foreground">
                      {goal.title}
                    </h4>
                    {goal.streak && (
                      <span className="flex items-center gap-1 text-xs text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">
                        <Flame className="w-3 h-3" />
                        {goal.streak}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground font-sans mt-0.5">
                    {goal.description}
                  </p>
                </div>
                <ValueTag value={goal.value} size="sm" />
              </div>
              
              {/* Progress Bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground font-sans mb-1.5">
                  <span>Progress</span>
                  <span className="font-medium">{goal.progress}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${goal.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Core Values Section */}
      <div className="px-4 py-4 animate-slide-up" style={{ animationDelay: "0.3s" }}>
        <div className="flex items-center gap-2 mb-3 px-1">
          <Heart className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
            Your Core Values
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {["health", "growth", "family", "work", "creativity"].map((value) => (
            <ValueTag key={value} value={value as ValueType} size="md" />
          ))}
        </div>
      </div>

      {/* Life Balance Overview */}
      <div className="px-4 py-4 animate-slide-up" style={{ animationDelay: "0.35s" }}>
        <div className="flex items-center gap-2 mb-3 px-1">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
            Life Balance
          </h3>
        </div>
        <div className="p-4 bg-card rounded-2xl shadow-soft">
          <div className="space-y-3">
            {[
              { label: "Health & Wellness", value: 75, color: "bg-tag-health" },
              { label: "Personal Growth", value: 60, color: "bg-tag-growth" },
              { label: "Family & Relationships", value: 85, color: "bg-tag-family" },
              { label: "Work & Career", value: 70, color: "bg-tag-work" },
              { label: "Creativity & Play", value: 45, color: "bg-tag-creativity" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs font-sans mb-1">
                  <span className="text-foreground">{item.label}</span>
                  <span className="text-muted-foreground">{item.value}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-500", item.color)}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
      <CoreAIFAB
        messages={coreAI.messages}
        onSendMessage={coreAI.sendMessage}
        isLoading={coreAI.isLoading}
        aiName={store.settings.coreAIName}
      />
    </div>
  );
};

export default Explore;
