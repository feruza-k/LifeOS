import { cn } from "@/lib/utils";

export type ValueType = "health" | "growth" | "family" | "work" | "creativity";

interface ValueTagProps {
  value: ValueType;
  size?: "sm" | "md";
}

const valueConfig: Record<ValueType, { label: string; className: string }> = {
  health: {
    label: "Health",
    className: "bg-tag-health/15 text-tag-health",
  },
  growth: {
    label: "Growth",
    className: "bg-primary/15 text-primary",
  },
  family: {
    label: "Family",
    className: "bg-tag-family/15 text-tag-family",
  },
  work: {
    label: "Work",
    className: "bg-tag-work/15 text-tag-work",
  },
  creativity: {
    label: "Creativity",
    className: "bg-tag-creativity/15 text-tag-creativity",
  },
};

export function ValueTag({ value, size = "sm" }: ValueTagProps) {
  const config = valueConfig[value];

  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-sans font-medium",
      size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
      config.className
    )}>
      {config.label}
    </span>
  );
}
