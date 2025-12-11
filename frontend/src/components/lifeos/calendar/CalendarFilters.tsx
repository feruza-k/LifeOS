import { cn } from "@/lib/utils";
import { ValueType } from "../ValueTag";
import { Filter } from "lucide-react";

interface CalendarFiltersProps {
  selectedCategories: ValueType[];
  onToggleCategory: (category: ValueType) => void;
}

const categories: { value: ValueType; label: string; colorClass: string }[] = [
  { value: "health", label: "Health", colorClass: "bg-tag-health" },
  { value: "growth", label: "Growth", colorClass: "bg-primary" },
  { value: "family", label: "Family", colorClass: "bg-tag-family" },
  { value: "work", label: "Work", colorClass: "bg-tag-work" },
  { value: "creativity", label: "Creativity", colorClass: "bg-tag-creativity" },
];

export function CalendarFilters({ selectedCategories, onToggleCategory }: CalendarFiltersProps) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide border-b border-border/30">
      <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      {categories.map((cat) => {
        const isSelected = selectedCategories.includes(cat.value);
        return (
          <button
            key={cat.value}
            onClick={() => onToggleCategory(cat.value)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-sans font-medium transition-all duration-200 flex-shrink-0",
              isSelected
                ? "bg-muted text-foreground"
                : "text-muted-foreground/60"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", cat.colorClass)} />
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
