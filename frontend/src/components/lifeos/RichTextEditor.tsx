import { useState, useRef, useEffect, KeyboardEvent, useCallback } from "react";
import { 
  Bold, 
  Italic, 
  List, 
  Circle, 
  Highlighter,
  X
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
  { value: "#F4D6E4" }, // Soft Rose (matches app's Dusty Rose)
  { value: "#C7DED5" }, // Muted Sage (matches app's sage green)
  { value: "#C9DCEB" }, // Pale Sky (matches app's blue)
  { value: "#E8D8BF" }, // Creamy Peach (warm, matches app's aesthetic)
  { value: null, isRemove: true }, // Remove highlight option
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

  const removeHighlight = useCallback(() => {
    if (!editorRef.current) return;
    
    // Close dropdown
    setHighlightDropdownOpen(false);
    
    // Focus editor
    editorRef.current.focus();
    
    // Restore selection
    setTimeout(() => {
      if (!editorRef.current) return;
      
      const selection = window.getSelection();
      let range: Range | null = null;
      
      // Try to restore saved selection
      if (selectionRef.current && editorRef.current.contains(selectionRef.current.commonAncestorContainer)) {
        try {
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(selectionRef.current);
            range = selectionRef.current;
          }
        } catch (err) {
          // Selection might be invalid
        }
      }
      
      // If no saved selection, try current selection
      if (!range && selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
        if (!editorRef.current.contains(range.commonAncestorContainer)) {
          range = null;
        }
      }
      
      // If we have a valid selection, remove highlights
      if (range) {
        if (range.collapsed) {
          // If collapsed (cursor), find and remove highlight from the containing element
          const container = range.commonAncestorContainer;
          let element = container.nodeType === Node.TEXT_NODE 
            ? container.parentElement 
            : container as Element;
          
          // Walk up to find highlighted span
          while (element && element !== editorRef.current) {
            if (element.tagName === 'SPAN' && element.getAttribute('style')?.includes('background-color')) {
              // Remove the span but keep its contents
              const parent = element.parentNode;
              if (parent) {
                while (element.firstChild) {
                  parent.insertBefore(element.firstChild, element);
                }
                parent.removeChild(element);
              }
              handleInput();
              saveSelection();
              editorRef.current.focus();
              return;
            }
            element = element.parentElement;
          }
        } else {
          // If we have a selection, remove highlights within it
          try {
            // Get all highlighted spans in the editor
            const allHighlights = editorRef.current.querySelectorAll('span[style*="background-color"]');
            
            allHighlights.forEach((el) => {
              const elRange = document.createRange();
              elRange.selectNodeContents(el);
              
              // Check if this element intersects with our selection
              if (range && (range.intersectsNode(el) || range.containsNode(el, true))) {
                // Remove the span but keep its contents
                const parent = el.parentNode;
                if (parent) {
                  while (el.firstChild) {
                    parent.insertBefore(el.firstChild, el);
                  }
                  parent.removeChild(el);
                }
              }
            });
            
            handleInput();
            saveSelection();
            editorRef.current.focus();
          } catch (error) {
            console.error("Failed to remove highlight:", error);
          }
        }
      }
    }, 100);
  }, [saveSelection, handleInput]);

  const applyHighlight = useCallback((color: string | null) => {
    // If color is null, remove highlight instead
    if (color === null) {
      removeHighlight();
      return;
    }
    if (!editorRef.current) return;
    
    // Close dropdown
    setHighlightDropdownOpen(false);
    
    // Focus editor immediately
    editorRef.current.focus();
    
    // Restore selection after a brief delay to ensure dropdown closes
    setTimeout(() => {
      if (!editorRef.current) return;
      
      const selection = window.getSelection();
      let range: Range | null = null;
      
      // Try to restore saved selection first
      if (selectionRef.current && editorRef.current.contains(selectionRef.current.commonAncestorContainer)) {
        try {
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(selectionRef.current);
            range = selectionRef.current;
          }
        } catch (err) {
          // Selection might be invalid, continue to try current selection
        }
      }
      
      // If no saved selection or it failed, try current selection
      if (!range && selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
        if (!editorRef.current.contains(range.commonAncestorContainer)) {
          range = null;
        }
      }
      
      // If we have a valid selection, highlight it
      if (range && !range.collapsed) {
        try {
          const selectedText = range.toString().trim();
          if (selectedText && selectedText.length > 0) {
            // Create highlight span
            const span = document.createElement("span");
            span.style.backgroundColor = color;
            span.style.padding = "0 2px";
            span.style.borderRadius = "3px";
            span.style.display = "inline";
            
            try {
              // Try to surround contents (works for simple selections)
              range.surroundContents(span);
            } catch (e) {
              try {
                // If that fails, extract and wrap
                const contents = range.extractContents();
                span.appendChild(contents);
                range.insertNode(span);
              } catch (e2) {
                // Last resort: delete and insert HTML
                const selectedText = range.toString();
                range.deleteContents();
                const html = `<span style="background-color: ${color}; padding: 0 2px; border-radius: 3px; display: inline;">${selectedText}</span>`;
                const fragment = document.createRange().createContextualFragment(html);
                range.insertNode(fragment);
              }
            }
            
            handleInput();
            saveSelection();
            editorRef.current.focus();
            return;
          }
        } catch (error) {
          console.error("Failed to apply highlight:", error);
        }
      }
      
      // No valid selection - try to select word at cursor
      try {
        editorRef.current.focus();
        // Try to select word using execCommand
        const success = document.execCommand("selectWord", false);
        if (success) {
          const newSel = window.getSelection();
          if (newSel && newSel.rangeCount > 0) {
            const newRange = newSel.getRangeAt(0);
            if (!newRange.collapsed && editorRef.current.contains(newRange.commonAncestorContainer)) {
              const selectedText = newRange.toString().trim();
              if (selectedText && selectedText.length > 0) {
                const span = document.createElement("span");
                span.style.backgroundColor = color;
                span.style.padding = "0 2px";
                span.style.borderRadius = "3px";
                span.style.display = "inline";
                
                try {
                  newRange.surroundContents(span);
                  handleInput();
                  saveSelection();
                  editorRef.current.focus();
                } catch (e) {
                  try {
                    const contents = newRange.extractContents();
                    span.appendChild(contents);
                    newRange.insertNode(span);
                    handleInput();
                    saveSelection();
                    editorRef.current.focus();
                  } catch (e2) {
                    console.error("Failed to apply highlight to word:", e2);
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("Failed to select word for highlighting:", e);
      }
    }, 100);
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
        {(isFocused || highlightDropdownOpen) && (
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
            <DropdownMenu 
              open={highlightDropdownOpen} 
              onOpenChange={(open) => {
                setHighlightDropdownOpen(open);
                if (open) {
                  // Save selection when opening
                  saveSelection();
                  // Keep editor focused
                  if (editorRef.current) {
                    editorRef.current.focus();
                  }
                } else {
                  // Restore focus when closing
                  if (editorRef.current) {
                    editorRef.current.focus();
                  }
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-12 w-12 p-0 rounded-xl hover:bg-muted/80 transition-colors active:scale-95",
                    highlightColor && "bg-primary/10"
                  )}
                  onMouseDown={(e) => { 
                    e.preventDefault();
                    e.stopPropagation();
                    saveSelection();
                    // Toggle dropdown
                    setHighlightDropdownOpen(prev => !prev);
                  }}
                  title="Highlight"
                >
                  <Highlighter className="w-6 h-6" strokeWidth={2.5} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="start" 
                className="w-auto p-3 z-[100]"
                sideOffset={8}
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                  // Restore focus to editor
                  setTimeout(() => {
                    if (editorRef.current) {
                      editorRef.current.focus();
                    }
                  }, 0);
                }}
                onEscapeKeyDown={() => {
                  setHighlightDropdownOpen(false);
                  if (editorRef.current) {
                    editorRef.current.focus();
                  }
                }}
              >
                <div className="grid grid-cols-5 gap-2.5">
                  {HIGHLIGHT_COLORS.map((color, index) => (
                    <button
                      key={color.value || "remove"}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyHighlight(color.value);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group active:scale-95"
                      title={color.isRemove ? "Remove highlight" : undefined}
                    >
                      {color.isRemove ? (
                        <div className="w-10 h-10 rounded-md border-2 border-border/50 shadow-sm group-hover:scale-110 transition-transform flex items-center justify-center bg-muted/30">
                          <X className="w-5 h-5 text-muted-foreground" strokeWidth={2.5} />
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "w-10 h-10 rounded-md border-2 shadow-sm group-hover:scale-110 transition-transform",
                            highlightColor === color.value ? "border-primary border-2 ring-2 ring-primary/20" : "border-border/50"
                          )}
                          style={{ backgroundColor: color.value }}
                        />
                      )}
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

