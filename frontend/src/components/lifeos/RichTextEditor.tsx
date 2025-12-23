import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Bold, Italic, List, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function RichTextEditor({ 
  content, 
  onChange, 
  placeholder = "Start writing...",
  autoFocus = false,
  className 
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (editorRef.current && !isFocused && editorRef.current.textContent !== content) {
      editorRef.current.textContent = content;
    }
  }, [content, isFocused]);

  const handleInput = () => {
    if (editorRef.current) {
      const newContent = editorRef.current.textContent || "";
      onChange(newContent);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "b") {
      e.preventDefault();
      formatText("bold");
      return;
    }
    
    if ((e.metaKey || e.ctrlKey) && e.key === "i") {
      e.preventDefault();
      formatText("italic");
      return;
    }

    if (e.key === "Enter") {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const textBeforeCursor = range.startContainer.textContent?.substring(0, range.startOffset) || "";
        const lineStart = textBeforeCursor.lastIndexOf("\n") + 1;
        const currentLine = textBeforeCursor.substring(lineStart);
        
        if (currentLine.trim() === "-" || currentLine === "- ") {
          e.preventDefault();
          document.execCommand("insertText", false, "\n- ");
          return;
        }
        
        if (currentLine.trim() === "- [ ]" || currentLine === "- [ ] ") {
          e.preventDefault();
          document.execCommand("insertText", false, "\n- [ ] ");
          return;
        }
      }
    }

    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        document.execCommand("outdent", false);
      } else {
        document.execCommand("indent", false);
      }
      if (editorRef.current) {
        onChange(editorRef.current.textContent || "");
      }
    }
  };

  const formatText = (command: string, showUI?: boolean, value?: string) => {
    document.execCommand(command, showUI || false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      onChange(editorRef.current.textContent || "");
    }
  };

  const insertBullet = () => {
    if (editorRef.current) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        document.execCommand("insertText", false, "- ");
        editorRef.current.focus();
        onChange(editorRef.current.textContent || "");
      }
    }
  };

  const insertCheckbox = () => {
    if (editorRef.current) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        document.execCommand("insertText", false, "- [ ] ");
        editorRef.current.focus();
        onChange(editorRef.current.textContent || "");
      }
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {isFocused && (
        <div className="flex items-center gap-1 p-2 border-b border-border/30 bg-muted/20 rounded-t-lg">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => formatText("bold")}
            title="Bold (Cmd+B)"
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => formatText("italic")}
            title="Italic (Cmd+I)"
          >
            <Italic className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-border/30 mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={insertBullet}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={insertCheckbox}
            title="Checkbox"
          >
            <CheckSquare className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            "absolute inset-0 p-4 overflow-y-auto",
            "focus:outline-none",
            "text-foreground font-sans text-base leading-relaxed",
            "whitespace-pre-wrap",
            className
          )}
          suppressContentEditableWarning
        />
        {!content && !isFocused && (
          <div className="absolute inset-0 p-4 pointer-events-none text-muted-foreground/50 font-sans text-base">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

