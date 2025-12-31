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

  // Process and map categories - ONLY show categories that exist in user's settings
  const categoryList = useMemo(() => {
    // Get all category IDs from user's settings
    const userCategoryIds = new Set(store.categories.map(c => c.id));
    const userCategoryLabels = new Set(store.categories.map(c => c.label.toLowerCase()));
    
    const entries = Object.entries(categoryBalance.distribution || {})
      .filter(([categoryId, count]) => {
        if (count <= 0) return false;
        
        // Only include if it matches a category in user's settings
        const isUserCategory = userCategoryIds.has(categoryId) || 
          userCategoryLabels.has(categoryId.toLowerCase());
        
        // Also check if it matches by finding the category
        if (!isUserCategory) {
          const categoryInfo = store.categories.find(c => 
            c.id === categoryId || 
            c.label.toLowerCase() === categoryId.toLowerCase()
          );
          return !!categoryInfo;
        }
        
        return isUserCategory;
      })
      .map(([categoryId, count]) => {
        // Find category by ID first
        let categoryInfo = store.categories.find(c => c.id === categoryId);
        
        // If not found, try by label
        if (!categoryInfo) {
          categoryInfo = store.categories.find(c => c.label.toLowerCase() === categoryId.toLowerCase());
        }
        
        // Only return if we found a matching category in settings
        if (!categoryInfo) {
          return null;
        }
        
        return {
          id: categoryInfo.id,
          label: categoryInfo.label,
          color: categoryInfo.color,
          count,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.count - a.count);
    
    const total = entries.reduce((sum, item) => sum + item.count, 0);
    
    return entries.map(item => ({
      ...item,
      percentage: total > 0 ? (item.count / total) * 100 : 0,
    }));
  }, [categoryBalance.distribution, store.categories]);

  // Check if we have valid data
  const hasDistribution = categoryList.length > 0;
  const maxCount = categoryList.length > 0 
    ? Math.max(...categoryList.map(item => item.count))
    : 0;

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

      {/* Bar Chart Visualization - Compact */}
      <div className="mb-4">
        <div className="space-y-2.5">
          {categoryList.map((item) => {
            const barWidth = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
            return (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-foreground font-sans font-medium">{item.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-sans font-medium">
                    {item.count} {item.count === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
                <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${barWidth}%`,
                      backgroundColor: item.color
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

