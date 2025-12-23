import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, isToday, isYesterday } from "date-fns";
import { Plus, ArrowLeft, FileText, Trash2, Search, X, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SideMenu, SideMenuButton } from "@/components/lifeos/SideMenu";
import { RichTextEditor } from "@/components/lifeos/RichTextEditor";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface GlobalNote {
  id: string;
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
    const cleaned = content
      .replace(/^- \[ \] /gm, "")
      .replace(/^- /gm, "")
      .trim();
    const firstLine = cleaned.split("\n")[0] || "";
    return firstLine.length > 80 ? firstLine.substring(0, 80) + "..." : firstLine || "Empty note";
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
      note.content.toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);

  if (selectedNoteId) {
    const note = notes.find(n => n.id === selectedNoteId);
    return (
      <NoteEditor
        note={note || null}
        onBack={() => setSelectedNoteId(null)}
        onSave={async (content) => {
          if (note) {
            await api.updateGlobalNote(note.id, { content });
          } else {
            const newNote = await api.createGlobalNote({ content });
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
    <div className="min-h-screen bg-background pb-24">
      <SideMenu isOpen={showSideMenu} onClose={() => setShowSideMenu(false)} />
      
      <div className="px-4 pt-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <SideMenuButton onClick={() => setShowSideMenu(true)} />
          <div className="flex-1">
            <h1 className="text-2xl font-serif font-semibold text-foreground">Notes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Thoughts & ideas</p>
          </div>
          <Button
            onClick={() => setSelectedNoteId("new")}
            size="sm"
            className="rounded-full gap-1"
          >
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>
        
        {notes.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-9 bg-muted/30 border-border/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-16">
            {searchQuery ? (
              <>
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground font-sans mb-2">No notes found</p>
                <p className="text-sm text-muted-foreground/70 mb-4">Try a different search term</p>
                <Button
                  onClick={() => setSearchQuery("")}
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                >
                  Clear search
                </Button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground font-sans mb-4">No notes yet</p>
                <Button
                  onClick={() => setSelectedNoteId("new")}
                  variant="outline"
                  className="rounded-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first note
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => setSelectedNoteId(note.id)}
                className="w-full text-left p-4 rounded-xl bg-muted/30 hover:bg-muted/50 border border-border/20 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-foreground text-sm whitespace-pre-wrap line-clamp-2 mb-1.5">
                      {getNotePreview(note.content)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatNoteDate(note.updated_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteNote(note.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-destructive/10 text-destructive shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {notes.length > 0 && (
        <button
          onClick={() => setSelectedNoteId("new")}
          className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors flex items-center justify-center z-30"
          aria-label="New note"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

interface NoteEditorProps {
  note: GlobalNote | null;
  onBack: () => void;
  onSave: (content: string) => Promise<void>;
  onDelete?: () => Promise<void>;
}

function NoteEditor({ note, onBack, onSave, onDelete }: NoteEditorProps) {
  const [content, setContent] = useState(note?.content || "");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setContent(note?.content || "");
    setHasUnsavedChanges(false);
    setLastSaved(note ? new Date(note.updated_at) : null);
  }, [note]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasUnsavedChanges(newContent !== (note?.content || ""));
    
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    setIsSaving(true);
    const timeout = setTimeout(async () => {
      try {
        await onSave(newContent);
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error("Failed to save note:", error);
      } finally {
        setIsSaving(false);
      }
    }, 1500);
    
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
    <div className="min-h-screen bg-background flex flex-col">
      <SideMenu isOpen={showSideMenu} onClose={() => setShowSideMenu(false)} />
      
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <SideMenuButton onClick={() => setShowSideMenu(true)} />
          <Button
            onClick={onBack}
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-muted"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <p className="text-sm font-sans font-medium text-foreground">
              {note ? "Edit Note" : "New Note"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSaving ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span>Saving...</span>
              </div>
            ) : lastSaved && !hasUnsavedChanges ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-primary" />
                <span>{formatLastSaved()}</span>
              </div>
            ) : hasUnsavedChanges ? (
              <span className="text-xs text-muted-foreground">Unsaved changes</span>
            ) : null}
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
                className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground/60 px-2">
          <span>Tip: Type <kbd className="px-1 py-0.5 bg-muted/50 rounded text-[10px]">-</kbd> for bullets, <kbd className="px-1 py-0.5 bg-muted/50 rounded text-[10px]">- [ ]</kbd> for checkboxes</span>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <RichTextEditor
          content={content}
          onChange={handleContentChange}
          placeholder="Start writing... Use - for bullets, - [ ] for checkboxes"
          autoFocus
          className="h-full"
        />
      </div>
    </div>
  );
}

