import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ValueType } from "../ValueTag";
import { Filter } from "lucide-react";
import { useLifeOSStore } from "@/stores/useLifeOSStore";

interface CalendarFiltersProps {
  selectedCategories: ValueType[];
  onToggleCategory: (category: ValueType) => void;
}

export function CalendarFilters({ selectedCategories, onToggleCategory }: CalendarFiltersProps) {
  const store = useLifeOSStore();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Persist filter state in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('calendar-filters-expanded');
    if (saved === 'true') {
      setIsExpanded(true);
    }
  }, []);
  
  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem('calendar-filters-expanded', String(newState));
  };
  
  return (
    <div className="border-b border-border/30 overflow-hidden transition-all duration-300">
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors"
      >
        <Filter className={cn(
          "w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-300",
          isExpanded && "rotate-90"
        )} />
        <span className="text-xs font-sans font-medium text-muted-foreground">Filter</span>
      </button>
      <div className={cn(
        "overflow-hidden transition-all duration-300 ease-in-out",
        isExpanded ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide">
          {store.categories.map((cat) => {
            const isSelected = selectedCategories.includes(cat.id as ValueType);
            return (
              <button
                key={cat.id}
                onClick={() => onToggleCategory(cat.id as ValueType)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-sans font-medium transition-all duration-200 flex-shrink-0",
                  isSelected
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground/60 hover:text-foreground"
                )}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full" 
                  style={{ backgroundColor: cat.color }}
                />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
