import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmationCardProps {
  message: string;
  preview?: any;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmationCard({ 
  message, 
  preview, 
  onConfirm, 
  onCancel,
  isLoading = false 
}: ConfirmationCardProps) {
  return (
    <div className="bg-card border border-border/30 rounded-xl px-3 py-2.5 space-y-2.5 mt-1.5 shadow-soft">
      {/* Only show message if it's different from what's already in the chat bubble */}
      {message && message.trim() && (
        <p className="text-sm font-sans text-foreground leading-normal">{message}</p>
      )}
      
      {preview && (
        <div className="bg-muted/50 rounded-lg px-2.5 py-2 border border-border/30">
          {preview.title && (
            <p className="text-sm font-sans font-medium text-foreground mb-0.5">
              {preview.title}
            </p>
          )}
          {preview.date && (
            <p className="text-xs font-sans text-muted-foreground leading-tight">
              {preview.time ? `${preview.date} at ${preview.time}` : preview.date}
            </p>
          )}
        </div>
      )}
      
      <div className="flex gap-2 pt-0.5">
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-xl font-sans text-sm font-medium transition-colors",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center justify-center gap-2"
          )}
        >
          <Check className="w-4 h-4" />
          Confirm
        </button>
        <button
          onClick={onCancel}
          disabled={isLoading}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-xl font-sans text-sm font-medium transition-colors",
            "bg-muted/50 text-foreground hover:bg-muted border border-border/30",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center justify-center gap-2"
          )}
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}

