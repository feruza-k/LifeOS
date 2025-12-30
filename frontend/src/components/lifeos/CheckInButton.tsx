import { Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CheckInButtonProps {
  onClick: () => void;
}

export function CheckInButton({ onClick }: CheckInButtonProps) {
  return (
    <div className="px-4 py-2 animate-slide-up" style={{ animationDelay: "0.4s" }}>
      <Button
        variant="outline"
        onClick={onClick}
        className="w-full h-12 rounded-xl border-border bg-card shadow-soft hover:bg-accent hover:border-primary/30 transition-all duration-200"
      >
        <Moon className="w-4 h-4 mr-2 text-primary" />
        <span className="text-sm font-sans font-medium text-foreground">Check-in & Reflect</span>
      </Button>
    </div>
  );
}
