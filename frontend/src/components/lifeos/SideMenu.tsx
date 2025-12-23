import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X, FileText, Bell, Settings, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSwipeable } from "react-swipeable";

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SideMenu({ isOpen, onClose }: SideMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleNavigate = (path: string) => {
    if (location.pathname !== path) {
      navigate(path);
    }
    onClose();
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (isOpen) {
        onClose();
      }
    },
    trackMouse: false,
    trackTouch: true,
    preventDefaultTouchmoveEvent: false,
    touchEventOptions: { passive: true },
  });

  const menuItems = [
    {
      path: "/notes",
      icon: FileText,
      title: "Notes",
      description: "Thoughts & ideas",
      active: location.pathname === "/notes",
    },
    {
      path: "/reminders",
      icon: Bell,
      title: "Reminders",
      description: "Never miss what matters",
      active: location.pathname === "/reminders",
    },
    {
      path: "/settings",
      icon: Settings,
      title: "Settings",
      description: "Preferences & options",
      active: location.pathname === "/settings",
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-foreground/40 backdrop-blur-md z-40 transition-opacity duration-300 ease-out",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      
      {/* Side Menu */}
      <div
        {...handlers}
        className={cn(
          "fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-gradient-to-r from-card/95 via-card/85 to-card/70 backdrop-blur-2xl border-r border-border/20 z-50 transform transition-all duration-300 ease-out flex flex-col shadow-2xl",
          isOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/30 shrink-0 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
          <h2 className="text-base font-sans font-semibold text-foreground tracking-tight">Menu</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-muted/40 hover:bg-muted/60 backdrop-blur-sm flex items-center justify-center transition-all active:scale-95"
            aria-label="Close menu"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto px-4 py-5">
          <div className="space-y-2.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isNotes = item.path === "/notes";
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left group relative backdrop-blur-sm",
                    item.active
                      ? "bg-primary/15 border border-primary/25 shadow-lg shadow-primary/10"
                      : "hover:bg-muted/40 border border-transparent active:scale-[0.98]",
                    isNotes && !item.active && "bg-primary/8"
                  )}
                >
                  {/* Active indicator */}
                  {item.active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                  )}
                  
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0",
                      item.active
                        ? "bg-primary/20 shadow-sm"
                        : "bg-muted/50 group-hover:bg-muted",
                      isNotes && !item.active && "bg-primary/10"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-6 h-6 transition-colors",
                        item.active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                        isNotes && !item.active && "text-primary/70"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "font-sans font-semibold text-base mb-0.5",
                        item.active ? "text-foreground" : "text-foreground/90 group-hover:text-foreground",
                        isNotes && "text-foreground"
                      )}
                    >
                      {item.title}
                    </p>
                    <p className="text-sm font-sans text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  {item.active && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 animate-fade-in" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
}

interface SideMenuButtonProps {
  onClick: () => void;
}

export function SideMenuButton({ onClick }: SideMenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-all active:scale-95 hover:scale-105"
      aria-label="Open menu"
    >
      <Menu className="w-5 h-5 text-foreground" />
    </button>
  );
}

