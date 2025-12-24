import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, isToday, isYesterday } from "date-fns";
import { Plus, ArrowLeft, FileText, Trash2, Search, X, CheckCircle2, Clock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SideMenu, SideMenuButton } from "@/components/lifeos/SideMenu";
import { BottomNav } from "@/components/lifeos/BottomNav";
import { RichTextEditor } from "@/components/lifeos/RichTextEditor";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface GlobalNote {
  id: string;
  title?: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function Notes() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<GlobalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const data = await api.getGlobalNotes();
      setNotes(data || []);
    } catch (error) {
      console.error("Failed to load notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this note?")) {
      return;
    }
    try {
      await api.deleteGlobalNote(noteId);
      setNotes(notes.filter(n => n.id !== noteId));
      if (selectedNoteId === noteId) {
        setSelectedNoteId(null);
      }
    } catch (error) {
      console.error("Failed to delete note:", error);
      alert("Failed to delete note. Please try again.");
    }
  };

  const getNotePreview = (content: string) => {
    if (!content) return "No content";
    
    // Strip HTML tags (safe for SSR)
    let text = content;
    if (typeof document !== "undefined") {
      const div = document.createElement("div");
      div.innerHTML = content;
      text = div.textContent || div.innerText || "";
    } else {
      // Fallback: simple regex to remove HTML tags
      text = content.replace(/<[^>]*>/g, "");
    }
    
    // Clean up list markers and formatting
    const cleaned = text
      .replace(/^[•○]\s*/gm, "")
      .replace(/^\d+\.\s*/gm, "")
      .trim();
    
    const firstLine = cleaned.split("\n")[0] || "";
    return firstLine.length > 100 ? firstLine.substring(0, 100) + "..." : firstLine || "No content";
  };

  const formatNoteDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, "h:mm a");
    }
    if (isYesterday(date)) {
      return "Yesterday";
    }
    return format(date, "MMM d, yyyy");
  };

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const query = searchQuery.toLowerCase();
    return notes.filter(note => 
      (note.title || "").toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);

  if (selectedNoteId) {
    const note = notes.find(n => n.id === selectedNoteId);
    return (
      <NoteEditor
        note={note || null}
        onBack={() => setSelectedNoteId(null)}
        onSave={async (title, content) => {
          if (note) {
            await api.updateGlobalNote(note.id, { title, content });
          } else {
            const newNote = await api.createGlobalNote({ title, content });
            setNotes([newNote, ...notes]);
            setSelectedNoteId(newNote.id);
          }
          await loadNotes();
        }}
        onDelete={note ? () => handleDeleteNote(note.id, { stopPropagation: () => {} } as React.MouseEvent) : undefined}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <SideMenu isOpen={showSideMenu} onClose={() => setShowSideMenu(false)} />
      
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <SideMenuButton onClick={() => setShowSideMenu(true)} />
            <div className="flex-1">
              <h1 className="text-2xl font-sans font-semibold text-foreground">Notes</h1>
              <p className="text-sm text-muted-foreground mt-1">Your thoughts & ideas</p>
            </div>
            <Button
              onClick={() => setSelectedNoteId("new")}
              size="lg"
              className="rounded-full gap-2 h-11 px-5"
            >
              <Plus className="w-5 h-5" />
              <span className="font-sans font-medium">New</span>
            </Button>
          </div>
          
          {/* Search */}
          {notes.length > 0 && (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-11 h-12 text-base bg-muted/30 border-border/30 rounded-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notes List */}
      <div className="px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-20">
            {searchQuery ? (
              <>
                <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
                  <Search className="w-10 h-10 text-muted-foreground/50" />
                </div>
                <p className="text-lg text-muted-foreground font-sans mb-2">No notes found</p>
                <p className="text-base text-muted-foreground/70 mb-6">Try a different search term</p>
                <Button
                  onClick={() => setSearchQuery("")}
                  variant="outline"
                  size="lg"
                  className="rounded-full"
                >
                  Clear search
                </Button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-10 h-10 text-muted-foreground/50" />
                </div>
                <p className="text-xl text-foreground font-sans font-medium mb-2">No notes yet</p>
                <p className="text-base text-muted-foreground mb-8">Start capturing your thoughts and ideas</p>
                <Button
                  onClick={() => setSelectedNoteId("new")}
                  size="lg"
                  className="rounded-full gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Create your first note
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => setSelectedNoteId(note.id)}
                className="w-full text-left p-5 rounded-2xl bg-card hover:bg-muted/50 border border-border/30 transition-all group shadow-sm hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-sans font-semibold text-foreground mb-2 line-clamp-1">
                      {note.title || "Untitled Note"}
                    </h3>
                    <p className="text-sm font-sans text-muted-foreground whitespace-pre-wrap line-clamp-2 mb-3 leading-relaxed">
                      {getNotePreview(note.content)}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{formatNoteDate(note.updated_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteNote(note.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-xl hover:bg-destructive/10 text-destructive shrink-0"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating New Note Button */}
      {notes.length > 0 && (
        <button
          onClick={() => setSelectedNoteId("new")}
          className="fixed bottom-28 right-6 w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105 flex items-center justify-center z-30"
          aria-label="New note"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      <BottomNav />
    </div>
  );
}

interface NoteEditorProps {
  note: GlobalNote | null;
  onBack: () => void;
  onSave: (title: string, content: string) => Promise<void>;
  onDelete?: () => Promise<void>;
}

function NoteEditor({ note, onBack, onSave, onDelete }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setTitle(note?.title || "");
    setContent(note?.content || "");
    setHasUnsavedChanges(false);
    setLastSaved(note ? new Date(note.updated_at) : null);
  }, [note]);

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      await onSave(title.trim() || "Untitled Note", content);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save note:", error);
      alert("Failed to save note. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasUnsavedChanges(
      newContent !== (note?.content || "") || 
      title.trim() !== (note?.title || "").trim()
    );
    
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    const timeout = setTimeout(async () => {
      if (!isSaving) {
        await handleSave();
      }
    }, 2000);
    
    setSaveTimeout(timeout);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setHasUnsavedChanges(
      newTitle.trim() !== (note?.title || "").trim() || 
      content !== (note?.content || "")
    );
    
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    const timeout = setTimeout(async () => {
      if (!isSaving) {
        await handleSave();
      }
    }, 2000);
    
    setSaveTimeout(timeout);
  };

  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  }, [saveTimeout]);

  const formatLastSaved = () => {
    if (!lastSaved) return "";
    const now = new Date();
    const diff = now.getTime() - lastSaved.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 10) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return format(lastSaved, "h:mm a");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      <SideMenu isOpen={showSideMenu} onClose={() => setShowSideMenu(false)} />
      
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 shrink-0">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <SideMenuButton onClick={() => setShowSideMenu(true)} />
            <Button
              onClick={onBack}
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-muted h-10 w-10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 flex items-center gap-3">
              {isSaving ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span>Saving...</span>
                </div>
              ) : lastSaved && !hasUnsavedChanges ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>{formatLastSaved()}</span>
                </div>
              ) : hasUnsavedChanges ? (
                <span className="text-sm text-muted-foreground">Unsaved changes</span>
              ) : null}
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              size="sm"
              className="rounded-full gap-2 h-9"
            >
              <Save className="w-4 h-4" />
              <span className="font-sans font-medium">Save</span>
            </Button>
            {onDelete && (
              <Button
                onClick={async () => {
                  if (confirm("Are you sure you want to delete this note?")) {
                    await onDelete();
                    onBack();
                  }
                }}
                variant="ghost"
                size="icon"
                className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 h-10 w-10"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            )}
          </div>
          
          {/* Title Input */}
          <Input
            type="text"
            placeholder="Note title..."
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="text-lg font-sans font-semibold h-11 border-0 bg-transparent focus-visible:ring-0 px-0 placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {/* Rich Text Editor */}
      <div className="flex-1 min-h-0 px-4 py-6">
        <RichTextEditor
          content={content}
          onChange={handleContentChange}
          placeholder="Start writing your thoughts..."
          autoFocus={!note}
          className="h-full min-h-[400px]"
        />
      </div>

      <BottomNav />
    </div>
  );
}
