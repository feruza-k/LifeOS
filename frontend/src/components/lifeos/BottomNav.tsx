import { CalendarDays, Compass, Sun, Calendar, Bell } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/calendar", icon: Calendar, label: "Calendar" },
  { to: "/", icon: Sun, label: "Today" },
  { to: "/explore", icon: Compass, label: "Explore" },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border pb-safe z-40">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-col items-center gap-1 px-6 py-2 transition-colors duration-200"
            >
              <div className={cn(
                "p-2 rounded-xl transition-all duration-200",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className={cn(
                "text-xs font-sans font-medium",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}