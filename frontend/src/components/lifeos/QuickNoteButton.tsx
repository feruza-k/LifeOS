import { BookOpen } from "lucide-react";

interface QuickNoteButtonProps {
  onClick: () => void;
  hasNote?: boolean;
}

export function QuickNoteButton({ onClick, hasNote }: QuickNoteButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-xl bg-card shadow-soft hover:shadow-card transition-all duration-200"
      aria-label="Open daily notes"
    >
      <BookOpen className="w-5 h-5 text-muted-foreground" />
      {hasNote && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full" />
      )}
    </button>
  );
}