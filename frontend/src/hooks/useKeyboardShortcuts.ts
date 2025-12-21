import { useEffect } from "react";

interface KeyboardShortcuts {
  onOpen?: () => void;
  onClose?: () => void;
  onSend?: () => void;
  onShowHelp?: () => void;
}

export function useKeyboardShortcuts({
  onOpen,
  onClose,
  onSend,
  onShowHelp,
}: KeyboardShortcuts) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open assistant
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpen?.();
        return;
      }
      
      // Esc to close
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      
      // Cmd/Ctrl + / to show help
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        onShowHelp?.();
        return;
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpen, onClose, onShowHelp]);
}

