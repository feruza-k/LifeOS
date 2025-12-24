import { useState, useRef, useEffect, KeyboardEvent, useCallback } from "react";
import { 
  Bold, 
  Italic, 
  List, 
  Circle, 
  Highlighter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#fef08a", label: "Yellow" },
  { name: "Green", value: "#bbf7d0", label: "Green" },
  { name: "Blue", value: "#bfdbfe", label: "Blue" },
  { name: "Pink", value: "#fce7f3", label: "Pink" },
  { name: "Orange", value: "#fed7aa", label: "Orange" },
];

export function RichTextEditor({ 
  content, 
  onChange, 
  placeholder = "Start writing...",
  autoFocus = false,
  className 
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightDropdownOpen, setHighlightDropdownOpen] = useState(false);
  const [highlightColor, setHighlightColor] = useState<string | null>(null);

  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (editorRef.current && !isFocused) {
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content || "";
      }
    }
  }, [content, isFocused]);

  // Make checkboxes clickable
  useEffect(() => {
    if (!editorRef.current) return;
    
    const handleCheckboxClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const listItem = target.closest('.note-checkbox-list li') as HTMLElement;
      
      if (listItem) {
        const rect = listItem.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        
        // Check if click is in the checkbox area (first 2rem / 32px)
        if (clickX < 36) {
          e.preventDefault();
          e.stopPropagation();
          
          // Toggle checked state
          if (listItem.classList.contains('checked')) {
            listItem.classList.remove('checked');
          } else {
            listItem.classList.add('checked');
          }
          
          if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
          }
        }
      }
    };
    
    editorRef.current.addEventListener('click', handleCheckboxClick);
    
    return () => {
      if (editorRef.current) {
        editorRef.current.removeEventListener('click', handleCheckboxClick);
      }
    };
  }, [onChange]);

  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editorRef.current) {
      const range = selection.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        selectionRef.current = range.cloneRange();
      }
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (selectionRef.current && editorRef.current) {
      const selection = window.getSelection();
      if (selection) {
        try {
          selection.removeAllRanges();
          selection.addRange(selectionRef.current);
        } catch (e) {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
  }, []);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const formatText = useCallback((command: string, value?: string) => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    restoreSelection();
    
    const success = document.execCommand(command, false, value);
    
    if (success) {
      handleInput();
      setTimeout(() => {
        saveSelection();
      }, 0);
    }
  }, [restoreSelection, saveSelection]);

  const insertBulletList = useCallback(() => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    saveSelection();
    restoreSelection();
    
    const success = document.execCommand("insertUnorderedList", false);
    
    if (success) {
      setTimeout(() => {
        if (!editorRef.current) return;
        
        const lists = editorRef.current.querySelectorAll("ul");
        lists.forEach((list) => {
          if (!list.classList.contains("note-checkbox-list")) {
            list.classList.remove("note-checkbox-list");
            list.classList.add("note-bullet-list");
          }
        });
        
        handleInput();
        saveSelection();
      }, 50);
    }
  }, [restoreSelection, saveSelection]);

  const insertCheckboxList = useCallback(() => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    saveSelection();
    restoreSelection();
    
    const success = document.execCommand("insertUnorderedList", false);
    
    if (success) {
      setTimeout(() => {
        if (!editorRef.current) return;
        
        const lists = editorRef.current.querySelectorAll("ul");
        lists.forEach((list) => {
          if (!list.classList.contains("note-bullet-list")) {
            list.classList.remove("note-bullet-list");
            list.classList.add("note-checkbox-list");
          }
        });
        
        handleInput();
        saveSelection();
      }, 50);
    }
  }, [restoreSelection, saveSelection]);

  const applyHighlight = useCallback((color: string) => {
    if (!editorRef.current) return;
    
    // Close dropdown
    setHighlightDropdownOpen(false);
    
    // Focus editor
    editorRef.current.focus();
    
    // Restore saved selection
    if (selectionRef.current) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        try {
          selection.addRange(selectionRef.current);
        } catch (err) {
          // Selection might be invalid
        }
      }
    }
    
    // Get current selection
    const selection = window.getSelection();
    let range: Range | null = null;
    
    if (selection && selection.rangeCount > 0) {
      range = selection.getRangeAt(0);
    }
    
    // If we have a valid selection, highlight it
    if (range && !range.collapsed) {
      try {
        const selectedText = range.toString();
        if (selectedText) {
          const span = document.createElement("span");
          span.style.backgroundColor = color;
          span.style.padding = "0 2px";
          span.style.borderRadius = "3px";
          
          try {
            range.surroundContents(span);
          } catch (e) {
            try {
              const contents = range.extractContents();
              span.appendChild(contents);
              range.insertNode(span);
            } catch (e2) {
              range.deleteContents();
              const html = `<span style="background-color: ${color}; padding: 0 2px; border-radius: 3px;">${selectedText}</span>`;
              const fragment = document.createRange().createContextualFragment(html);
              range.insertNode(fragment);
            }
          }
          
          handleInput();
          saveSelection();
        }
      } catch (error) {
        console.error("Failed to apply highlight:", error);
      }
    } else {
      // No selection - try to select word at cursor
      try {
        document.execCommand("selectWord", false);
        const newSel = window.getSelection();
        if (newSel && newSel.rangeCount > 0) {
          const newRange = newSel.getRangeAt(0);
          if (!newRange.collapsed) {
            // We have a word selected, highlight it
            const selectedText = newRange.toString();
            if (selectedText) {
              const span = document.createElement("span");
              span.style.backgroundColor = color;
              span.style.padding = "0 2px";
              span.style.borderRadius = "3px";
              
              try {
                newRange.surroundContents(span);
                handleInput();
                saveSelection();
              } catch (e) {
                try {
                  const contents = newRange.extractContents();
                  span.appendChild(contents);
                  newRange.insertNode(span);
                  handleInput();
                  saveSelection();
                } catch (e2) {
                  // Ignore if it fails
                }
              }
            }
          }
        }
      } catch (e) {
        // Can't select word, just set the color for visual feedback
        setHighlightColor(color);
      }
    }
    
    editorRef.current.focus();
  }, [saveSelection, handleInput]);

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
  };

  return (
    <>
      <style>{`
        .note-bullet-list {
          list-style: none !important;
          padding-left: 0 !important;
          margin: 0.75rem 0 !important;
        }
        .note-bullet-list li {
          position: relative !important;
          padding-left: 2rem !important;
          margin: 0.5rem 0 !important;
          list-style: none !important;
          min-height: 1.75rem;
        }
        .note-bullet-list li::before {
          content: "•" !important;
          position: absolute !important;
          left: 0.25rem !important;
          color: var(--foreground) !important;
          font-weight: 600 !important;
          font-size: 1.3em !important;
          line-height: 1.4 !important;
        }
        .note-checkbox-list {
          list-style: none !important;
          padding-left: 0 !important;
          margin: 0.75rem 0 !important;
        }
        .note-checkbox-list li {
          position: relative !important;
          padding-left: 2.25rem !important;
          margin: 0.5rem 0 !important;
          list-style: none !important;
          min-height: 1.75rem;
          cursor: pointer;
        }
        .note-checkbox-list li::before {
          content: "○" !important;
          position: absolute !important;
          left: 0.25rem !important;
          color: var(--foreground) !important;
          font-size: 1.2em !important;
          line-height: 1.4 !important;
          transition: all 0.2s ease;
        }
        .note-checkbox-list li.checked::before {
          content: "●" !important;
          color: var(--primary) !important;
        }
        .note-checkbox-list li.checked {
          opacity: 0.7;
          text-decoration: line-through;
        }
        .note-editor mark,
        .note-editor span[style*="background-color"] {
          padding: 0 2px;
          border-radius: 3px;
        }
      `}</style>
      <div className={cn("flex flex-col h-full bg-card rounded-2xl border border-border/30 overflow-hidden", className)}>
        {/* Formatting Toolbar - Apple Notes Style */}
        {isFocused && (
          <div className="flex items-center gap-3 p-4 border-b border-border/30 bg-muted/20 shrink-0">
            {/* Bold */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-12 w-12 p-0 rounded-xl hover:bg-muted/80 transition-colors active:scale-95"
              onMouseDown={(e) => { 
                e.preventDefault(); 
                saveSelection();
                formatText("bold"); 
              }}
              title="Bold (⌘B)"
            >
              <Bold className="w-6 h-6" strokeWidth={2.5} />
            </Button>

            {/* Italic */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-12 w-12 p-0 rounded-xl hover:bg-muted/80 transition-colors active:scale-95"
              onMouseDown={(e) => { 
                e.preventDefault(); 
                saveSelection();
                formatText("italic"); 
              }}
              title="Italic (⌘I)"
            >
              <Italic className="w-6 h-6" strokeWidth={2.5} />
            </Button>

            {/* Highlight */}
            <DropdownMenu open={highlightDropdownOpen} onOpenChange={setHighlightDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-12 w-12 p-0 rounded-xl hover:bg-muted/80 transition-colors active:scale-95",
                    highlightColor && "bg-primary/10"
                  )}
                  onClick={(e) => { 
                    e.preventDefault();
                    e.stopPropagation();
                    saveSelection();
                    setHighlightDropdownOpen(true);
                  }}
                  title="Highlight"
                >
                  <Highlighter className="w-6 h-6" strokeWidth={2.5} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="start" 
                className="w-56 p-3"
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                  if (editorRef.current) {
                    editorRef.current.focus();
                  }
                }}
              >
                <div className="grid grid-cols-5 gap-2">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyHighlight(color.value);
                      }}
                      className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                      title={color.label}
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-md border-2 shadow-sm group-hover:scale-110 transition-transform",
                          highlightColor === color.value ? "border-primary border-2" : "border-border/50"
                        )}
                        style={{ backgroundColor: color.value }}
                      />
                      <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                        {color.label}
                      </span>
                    </button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-px h-8 bg-border/40 mx-1" />

            {/* Bullet List */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-12 w-12 p-0 rounded-xl hover:bg-muted/80 transition-colors active:scale-95"
              onMouseDown={(e) => { 
                e.preventDefault(); 
                saveSelection();
                insertBulletList(); 
              }}
              title="Bullet List"
            >
              <List className="w-6 h-6" strokeWidth={2.5} />
            </Button>

            {/* Radio Button (Checkbox) */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-12 w-12 p-0 rounded-xl hover:bg-muted/80 transition-colors active:scale-95"
              onMouseDown={(e) => { 
                e.preventDefault(); 
                saveSelection();
                insertCheckboxList(); 
              }}
              title="Checkbox (Radio)"
            >
              <Circle className="w-6 h-6" strokeWidth={2.5} />
            </Button>
          </div>
        )}

        {/* Editor */}
        <div className="relative flex-1 min-h-0 overflow-y-auto">
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => { 
              setIsFocused(true); 
              saveSelection(); 
            }}
            onBlur={() => { 
              setIsFocused(false); 
              saveSelection(); 
            }}
            onMouseUp={saveSelection}
            onKeyUp={saveSelection}
            className={cn(
              "note-editor w-full h-full p-8",
              "focus:outline-none",
              "text-foreground font-sans leading-relaxed",
              "whitespace-pre-wrap break-words"
            )}
            style={{
              minHeight: "400px",
              fontSize: "17px",
              lineHeight: "1.7"
            }}
            suppressContentEditableWarning
          />
          {!content && !isFocused && (
            <div 
              className="absolute inset-0 p-8 pointer-events-none text-muted-foreground/50 font-sans"
              style={{
                fontSize: "17px",
                lineHeight: "1.7"
              }}
            >
              {placeholder}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
