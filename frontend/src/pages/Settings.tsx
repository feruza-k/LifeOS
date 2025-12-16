import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  User, 
  Globe, 
  Languages, 
  Calendar, 
  Bell, 
  Clock, 
  Trash2, 
  Download, 
  ChevronRight, 
  Camera,
  Tag,
  Shield,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TopBrand } from "@/components/lifeos/TopBrand";
import { BottomNav } from "@/components/lifeos/BottomNav";
import { CoreAIFAB } from "@/components/lifeos/CoreAI/CoreAIFAB";
import { useLifeOSStore } from "@/hooks/useLifeOSStore";
import { useCoreAI } from "@/hooks/useCoreAI";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface SettingsSection {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

function SettingsGroup({ title, icon: Icon, children }: SettingsSection) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-sans font-medium text-foreground">{title}</h2>
      </div>
      <div className="bg-card rounded-2xl border border-border/50 divide-y divide-border/50">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ 
  label, 
  description, 
  children, 
  onClick,
  danger = false 
}: { 
  label: string; 
  description?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <div 
      className={cn(
        "flex items-center justify-between p-4",
        onClick && "cursor-pointer hover:bg-muted/50 transition-colors"
      )}
      onClick={onClick}
    >
      <div className="flex-1">
        <p className={cn("font-sans text-sm", danger ? "text-destructive" : "text-foreground")}>
          {label}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
      {onClick && !children && (
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      )}
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const store = useLifeOSStore();
  const coreAI = useCoreAI();
  
  const [name, setName] = useState("User");
  const [timezone, setTimezone] = useState("America/New_York");
  const [language, setLanguage] = useState("en");
  const [weekStart, setWeekStart] = useState("monday");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [defaultReminderTime, setDefaultReminderTime] = useState("09:00");

  const handleClearData = () => {
    localStorage.clear();
    toast.success("All data cleared. Refreshing...");
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleExportData = () => {
    const data = {
      tasks: store.tasks,
      notes: store.notes,
      reminders: store.reminders,
      settings: store.settings,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifeos-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported successfully");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopBrand />
      
      <div className="px-4 pt-4 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl text-foreground font-sans font-semibold">Settings</h1>
              <p className="text-sm text-muted-foreground mt-1">Customize your LifeOS experience</p>
            </div>
          </div>
        </div>

        {/* Profile */}
        <SettingsGroup title="Profile" icon={User}>
          <SettingsRow label="User Profile" description="Manage your account settings" onClick={() => navigate("/profile")} />
          
          <SettingsRow label="Timezone">
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/New_York">Eastern Time</SelectItem>
                <SelectItem value="America/Chicago">Central Time</SelectItem>
                <SelectItem value="America/Denver">Mountain Time</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                <SelectItem value="Europe/London">London</SelectItem>
                <SelectItem value="Europe/Paris">Paris</SelectItem>
                <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow label="Language">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
        </SettingsGroup>

        {/* Tasks */}
        <SettingsGroup title="Tasks" icon={Tag}>
          <Link to="/categories">
            <SettingsRow 
              label="Manage categories" 
              description="Customize task value categories"
            />
          </Link>
          
          <SettingsRow label="Week starts on">
            <Select value={weekStart} onValueChange={setWeekStart}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sunday">Sunday</SelectItem>
                <SelectItem value="monday">Monday</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
        </SettingsGroup>

        {/* Reminders */}
        <SettingsGroup title="Reminders" icon={Bell}>
          <SettingsRow label="Notifications">
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={setNotificationsEnabled}
            />
          </SettingsRow>
          
          <SettingsRow label="Default reminder time">
            <Input
              type="time"
              value={defaultReminderTime}
              onChange={(e) => setDefaultReminderTime(e.target.value)}
              className="w-28 h-8 text-xs"
            />
          </SettingsRow>
        </SettingsGroup>

        {/* Data & Privacy */}
        <SettingsGroup title="Data & Privacy" icon={Shield}>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <div>
                <SettingsRow 
                  label="Clear reflections & notes" 
                  description="Remove all notes and reflection data"
                  danger
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </SettingsRow>
              </div>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all your tasks, notes, reminders, and settings. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearData} className="bg-destructive text-destructive-foreground">
                  Clear all data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          <SettingsRow 
            label="Export data" 
            description="Download all your data as JSON"
            onClick={handleExportData}
          >
            <Download className="w-4 h-4 text-muted-foreground" />
          </SettingsRow>
        </SettingsGroup>

        {/* App Info */}
        <div className="text-center mt-8 text-xs text-muted-foreground">
          <p>LifeOS v1.0.0</p>
          <p className="mt-1">Powered by SolAI</p>
        </div>
      </div>

      <BottomNav />
      <CoreAIFAB
        messages={coreAI.messages}
        onSendMessage={coreAI.sendMessage}
        isLoading={coreAI.isLoading}
        aiName={store.settings.coreAIName}
      />
    </div>
  );
}
