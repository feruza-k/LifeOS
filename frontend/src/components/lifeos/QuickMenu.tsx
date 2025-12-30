import { useNavigate, useLocation } from "react-router-dom";
import { MoreVertical, FileText, Bell, Settings } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function QuickMenu() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      path: "/settings",
      icon: Settings,
      title: "Settings",
      active: location.pathname === "/settings",
    },
    {
      path: "/reminders",
      icon: Bell,
      title: "Reminders",
      active: location.pathname === "/reminders",
    },
    {
      path: "/notes",
      icon: FileText,
      title: "Notes",
      active: location.pathname === "/notes",
    },
  ];

  const handleNavigate = (path: string) => {
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="w-10 h-10 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-all active:scale-95 hover:scale-105"
          aria-label="Open quick menu"
        >
          <MoreVertical className="w-5 h-5 text-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-56 p-2" 
        align="end"
        sideOffset={8}
      >
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left",
                  item.active
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-sans font-medium">{item.title}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

