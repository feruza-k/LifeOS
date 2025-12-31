import { PieChart } from "lucide-react";
import { useLifeOSStore } from "@/stores/useLifeOSStore";

interface CategoryBalanceViewProps {
  categoryBalance: {
    distribution: Record<string, number>;
    score: number;
    status: "balanced" | "moderate" | "imbalanced";
  };
}

export function CategoryBalanceView({ categoryBalance }: CategoryBalanceViewProps) {
  const store = useLifeOSStore();

  // Check if we have valid data
  const hasDistribution = categoryBalance.distribution && 
    Object.keys(categoryBalance.distribution).length > 0 &&
    Object.values(categoryBalance.distribution).some(count => count > 0);

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

      {/* Pie Chart Visualization */}
      <div className="mb-6 flex items-center justify-center">
        <div className="relative">
          <svg 
            width="200" 
            height="200" 
            viewBox="0 0 200 200" 
            className="transform -rotate-90"
            style={{ display: 'block' }}
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
              const entries = Object.entries(categoryBalance.distribution || {})
                .filter(([_, count]) => count > 0) // Filter out zero counts
                .sort((a, b) => b[1] - a[1]);
              
              if (entries.length === 0) {
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
              
              const total = entries.reduce((sum, [_, count]) => sum + count, 0);
              if (total === 0) {
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
              
              return entries.map(([categoryId, count]) => {
                const categoryInfo = store.categories.find(c => c.id === categoryId);
                const percentage = (count / total) * 100;
                const angle = (percentage / 100) * 360;
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
                    key={categoryId}
                    d={pathData}
                    fill={categoryInfo?.color || "hsl(var(--primary))"}
                    stroke="hsl(var(--background))"
                    strokeWidth="3"
                    className="transition-all duration-300 hover:opacity-80"
                  />
                );
              });
            })()}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-sans font-bold text-foreground">
              {Math.round(categoryBalance.score * 100)}%
            </span>
            <span className="text-xs font-sans text-muted-foreground mt-0.5">
              Balance
            </span>
          </div>
        </div>
      </div>
      
      {/* Category Distribution List */}
      <div className="space-y-3">
        {Object.entries(categoryBalance.distribution)
          .sort((a, b) => b[1] - a[1])
          .map(([categoryId, count]) => {
            const categoryInfo = store.categories.find(c => c.id === categoryId);
            const label = categoryInfo?.label || categoryId;
            const total = Object.values(categoryBalance.distribution).reduce((a, b) => a + b, 0);
            const percentage = (count / total) * 100;
            return (
              <div key={categoryId} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: categoryInfo?.color || "hsl(var(--primary))" }}
                    />
                    <span className="text-sm text-foreground font-sans font-medium">{label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-sans">{Math.round(percentage)}%</span>
                </div>
                <div className="w-full h-2 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 shadow-sm"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: categoryInfo?.color || "hsl(var(--primary))"
                    }}
                  />
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}

