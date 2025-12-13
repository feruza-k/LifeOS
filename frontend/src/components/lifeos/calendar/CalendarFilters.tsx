import { cn } from "@/lib/utils";
import { ValueType } from "../ValueTag";
import { Filter } from "lucide-react";
import { useLifeOSStore } from "@/hooks/useLifeOSStore";

interface CalendarFiltersProps {
  selectedCategories: ValueType[];
  onToggleCategory: (category: ValueType) => void;
}

export function CalendarFilters({ selectedCategories, onToggleCategory }: CalendarFiltersProps) {
  const store = useLifeOSStore();
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide border-b border-border/30">
      <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
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
                : "text-muted-foreground/60"
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
  );
}
