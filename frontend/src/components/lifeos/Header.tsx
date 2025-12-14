import { format } from "date-fns";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

const morningGreetings = [
  "Good morning. Let's align your actions with your future self.",
  "Rise and shine. Today is full of potential.",
  "Good morning. Small steps lead to big changes.",
  "Morning light brings new opportunities.",
  "Good morning. Your future self will thank you.",
];

const afternoonGreetings = [
  "Good afternoon. Stay focused on what matters.",
  "Keep the momentum going this afternoon.",
  "Good afternoon. You're making progress.",
  "The day is half done. Finish strong.",
  "Good afternoon. Every task completed is a win.",
];

const eveningGreetings = [
  "Good evening. Reflect on your wins today.",
  "Wind down with intention tonight.",
  "Good evening. Rest is part of the journey.",
  "Evening time. Celebrate your efforts today.",
  "Good evening. Tomorrow is a fresh start.",
];

function getGreeting(): string {
  const hour = new Date().getHours();
  const greetings = hour < 12 ? morningGreetings : hour < 17 ? afternoonGreetings : eveningGreetings;
  const randomIndex = Math.floor(Math.random() * greetings.length);
  return greetings[randomIndex];
}

interface HeaderProps {
  onTitleClick?: () => void;
}

export function Header({ onTitleClick }: HeaderProps) {
  const today = new Date();
  const greeting = useMemo(() => getGreeting(), []);

  return (
    <header className="px-2 pt-2 pb-2 animate-fade-in text-left">
      <h1 
        onClick={onTitleClick}
        className={cn(
          "text-2xl text-foreground mt-1 font-sans font-semibold",
          onTitleClick && "cursor-pointer hover:opacity-80 transition-opacity"
        )}
      >
        Today, {format(today, "MMM d")}
      </h1>
      <p className="text-sm text-muted-foreground font-sans mt-1 leading-relaxed">
        {greeting}
      </p>
    </header>
  );
}
