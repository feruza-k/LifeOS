import { PieChart } from "lucide-react";
import { useLifeOSStore } from "@/stores/useLifeOSStore";
import { useMemo } from "react";

interface CategoryBalanceViewProps {
  categoryBalance: {
    distribution: Record<string, number>;
    score: number;
    status: "balanced" | "moderate" | "imbalanced";
  };
}

export function CategoryBalanceView({ categoryBalance }: CategoryBalanceViewProps) {
  const store = useLifeOSStore();

  // Process and map categories properly
  const categoryList = useMemo(() => {
    const entries = Object.entries(categoryBalance.distribution || {})
      .filter(([_, count]) => count > 0)
      .map(([categoryId, count]) => {
        // Try to find category by ID first
        let categoryInfo = store.categories.find(c => c.id === categoryId);
        
        // If not found, try to find by label (in case ID is actually a label)
        if (!categoryInfo) {
          categoryInfo = store.categories.find(c => c.label.toLowerCase() === categoryId.toLowerCase());
        }
        
        return {
          id: categoryId,
          label: categoryInfo?.label || categoryId,
          color: categoryInfo?.color || "hsl(var(--primary))",
          count,
        };
      })
      .sort((a, b) => b.count - a.count);
    
    const total = entries.reduce((sum, item) => sum + item.count, 0);
    
    return entries.map(item => ({
      ...item,
      percentage: total > 0 ? (item.count / total) * 100 : 0,
    }));
  }, [categoryBalance.distribution, store.categories]);

  // Check if we have valid data
  const hasDistribution = categoryList.length > 0;

  if (!hasDistribution) {
    return (
      <>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
              Category Balance
            </h3>
          </div>
          <span className="text-xs text-muted-foreground font-sans">Past Month</span>
        </div>
        <div className="text-center py-8 text-muted-foreground text-sm">
          No category data available yet
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wide">
            Category Balance
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-sans">Past Month</span>
          <span className={`text-xs font-sans font-medium px-2 py-1 rounded ${
            categoryBalance.status === "balanced" 
              ? "bg-primary/20 text-primary" 
              : categoryBalance.status === "imbalanced"
              ? "bg-amber-500/20 text-amber-600"
              : "bg-muted text-muted-foreground"
          }`}>
            {categoryBalance.status === "balanced" ? "Balanced" : 
             categoryBalance.status === "imbalanced" ? "Imbalanced" : "Moderate"}
          </span>
        </div>
      </div>

      {/* Summary Stats - Match EnergyPatternsView style */}
      <div className="mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-sans font-bold text-foreground">
              {categoryList.length}
            </div>
            <div className="text-xs text-muted-foreground font-sans uppercase mt-1">Categories</div>
          </div>
          <div>
            <div className="text-2xl font-sans font-bold text-foreground">
              {Math.round(categoryBalance.score * 100)}%
            </div>
            <div className="text-xs text-muted-foreground font-sans uppercase mt-1">Balance</div>
          </div>
          <div>
            <div className="text-2xl font-sans font-bold text-foreground">
              {categoryList.reduce((sum, item) => sum + item.count, 0)}
            </div>
            <div className="text-xs text-muted-foreground font-sans uppercase mt-1">Total Tasks</div>
          </div>
        </div>
      </div>

      {/* Pie Chart Visualization */}
      <div className="mb-6 flex items-center justify-center">
        <div className="relative" style={{ width: '200px', height: '200px' }}>
          <svg 
            width="200" 
            height="200" 
            viewBox="0 0 200 200" 
            className="transform -rotate-90"
            style={{ display: 'block', width: '100%', height: '100%' }}
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Background circle */}
            <circle
              cx="100"
              cy="100"
              r="85"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="3"
              opacity="0.3"
            />
            {(() => {
              if (categoryList.length === 0) {
                return (
                  <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill="hsl(var(--muted))"
                    opacity="0.2"
                  />
                );
              }
              
              let currentAngle = 0;
              const radius = 85;
              const centerX = 100;
              const centerY = 100;
              const gap = 2;
              
              return categoryList.map((item) => {
                const angle = (item.percentage / 100) * 360;
                const startAngle = currentAngle + (gap / 2);
                const endAngle = currentAngle + angle - (gap / 2);
                currentAngle += angle;
                
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
                    key={item.id}
                    d={pathData}
                    fill={item.color}
                    stroke="hsl(var(--background))"
                    strokeWidth="3"
                    className="transition-all duration-300 hover:opacity-80"
                  />
                );
              });
            })()}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ zIndex: 1 }}>
            <span className="text-2xl font-sans font-bold text-foreground">
              {Math.round(categoryBalance.score * 100)}%
            </span>
            <span className="text-xs font-sans text-muted-foreground mt-0.5">
              Balance
            </span>
          </div>
        </div>
      </div>
      
      {/* Category List - Clean, no bars */}
      <div className="space-y-2">
        {categoryList.map((item) => (
          <div key={item.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-foreground font-sans font-medium">{item.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-sans">{item.count} tasks</span>
              <span className="text-xs text-muted-foreground font-sans font-medium">
                {Math.round(item.percentage)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

