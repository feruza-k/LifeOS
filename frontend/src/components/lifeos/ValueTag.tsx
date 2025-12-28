import { cn } from "@/lib/utils";
import { useLifeOSStore } from "@/stores/useLifeOSStore";

export type ValueType = "social" | "self" | "growth" | "work" | "essentials" | string;

interface ValueTagProps {
  value: ValueType;
  size?: "sm" | "md";
}

// Fallback config for when category is not found
const fallbackConfig = {
  label: "Task",
  color: "#EBEBEB",
};

// Helper function to convert hex to rgba
const hexToRgba = (hex: string, opacity: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export function ValueTag({ value, size = "sm" }: ValueTagProps) {
  const store = useLifeOSStore();
  
  // Find the category from the store
  const category = store.categories.find(c => c.id === value);
  
  // Use category data if found, otherwise use fallback
  const label = category?.label || fallbackConfig.label;
  const color = category?.color || fallbackConfig.color;
  
  // Create styles with the actual category color
  const backgroundColor = hexToRgba(color, 0.6);
  const textColor = color;

  return (
    <span 
      className={cn(
        "inline-flex items-center rounded-full font-sans font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      )}
      style={{
        backgroundColor,
        color: textColor,
      }}
    >
      {label}
    </span>
  );
}
