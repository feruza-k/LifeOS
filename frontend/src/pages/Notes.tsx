import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, isToday, isYesterday } from "date-fns";
import { 
  Plus, ArrowLeft, FileText, Trash2, Search, X, CheckCircle2, Clock, Save, 
  Pin, Archive, ArchiveRestore, Image as ImageIcon, Mic, MicOff, Play, Pause,
  SortAsc, ChevronDown, MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QuickMenu } from "@/components/lifeos/QuickMenu";
import { BottomNav } from "@/components/lifeos/BottomNav";
import { RichTextEditor } from "@/components/lifeos/RichTextEditor";
import { CoreAIFAB } from "@/components/lifeos/CoreAI/CoreAIFAB";
import { useCoreAI } from "@/hooks/useCoreAI";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface GlobalNote {
  id: string;
  title?: string;
  content: string;
  pinned?: boolean;
  archived?: boolean;
  tags?: string[];
  audio_filename?: string;
  image_filename?: string;
  created_at: string;
  updated_at: string;
}

// Haptic feedback utility
const triggerHaptic = (type: "light" | "medium" | "heavy" = "light") => {
  if ("vibrate" in navigator) {
    const patterns = { light: 10, medium: 20, heavy: 30 };
    navigator.vibrate(patterns[type]);
  }
};

export default function Notes() {
  const navigate = useNavigate();
  const coreAI = useCoreAI();
  const [notes, setNotes] = useState<GlobalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("updated_at");
  const [showArchived, setShowArchived] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [swipingNoteId, setSwipingNoteId] = useState<string | null>(null);

  // Check if user has seen onboarding
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("notes_onboarding_seen");
    if (!hasSeenOnboarding && notes.length === 0 && !loading) {
      setShowOnboarding(true);
    }
  }, [notes.length, loading]);

  useEffect(() => {
    loadNotes();
  }, [sortBy, showArchived]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const params: any = {
        sort_by: sortBy,
        include_archived: showArchived,
      };
      const data = await api.getGlobalNotes(params);
      setNotes(data || []);
    } catch (error) {
      console.error("Failed to load notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePinNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("light");
    try {
      const note = notes.find(n => n.id === noteId);
      if (note?.pinned) {
        await api.unpinGlobalNote(noteId);
      } else {
        await api.pinGlobalNote(noteId);
      }
      await loadNotes();
    } catch (error) {
      console.error("Failed to pin note:", error);
    }
  };

  const handleArchiveNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("medium");
    try {
      const note = notes.find(n => n.id === noteId);
      if (note?.archived) {
        await api.unarchiveGlobalNote(noteId);
      } else {
        await api.archiveGlobalNote(noteId);
      }
      await loadNotes();
    } catch (error) {
      console.error("Failed to archive note:", error);
    }
  };

  const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("medium");
    if (!confirm("Are you sure you want to delete this note?")) {
      return;
    }
    try {
      await api.deleteGlobalNote(noteId);
      setNotes(notes.filter(n => n.id !== noteId));
      if (selectedNoteId === noteId) {
        setSelectedNoteId(null);
      }
    triggerHaptic("heavy");
  } catch (error) {
      console.error("Failed to delete note:", error);
      alert("Failed to delete note. Please try again.");
    }
  };

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent, noteId: string) => {
    setSwipeStartX(e.touches[0].clientX);
    setSwipingNoteId(noteId);
  };

  const handleTouchMove = (e: React.TouchEvent, noteId: string) => {
    if (swipeStartX === null || swipingNoteId !== noteId) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - swipeStartX;
    const element = e.currentTarget as HTMLElement;
    
    if (Math.abs(diff) > 10) {
      element.style.transform = `translateX(${diff}px)`;
      element.style.transition = "none";
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, noteId: string) => {
    if (swipeStartX === null || swipingNoteId !== noteId) return;
    const diff = e.changedTouches[0].clientX - swipeStartX;
    const element = e.currentTarget as HTMLElement;
    element.style.transform = "";
    element.style.transition = "transform 0.3s ease-out";

    const threshold = 100;
    if (diff < -threshold) {
      // Swipe left = archive
      handleArchiveNote(noteId, { stopPropagation: () => {} } as React.MouseEvent);
      triggerHaptic("medium");
    } else if (diff > threshold) {
      // Swipe right = pin
      handlePinNote(noteId, { stopPropagation: () => {} } as React.MouseEvent);
      triggerHaptic("light");
    }
    
    setSwipeStartX(null);
    setSwipingNoteId(null);
  };

  const handleSwipeDown = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0 && e.touches[0].clientY > 100) {
      const diff = e.touches[0].clientY - 50;
      if (diff > 80) {
        triggerHaptic("light");
        setSelectedNoteId("new");
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener("touchmove", handleSwipeDown);
    return () => window.removeEventListener("touchmove", handleSwipeDown);
  }, [handleSwipeDown]);

  const getNotePreview = (content: string) => {
    if (!content) return "No content";
    
    let text = content;
    if (typeof document !== "undefined") {
      const div = document.createElement("div");
      div.innerHTML = content;
      text = div.textContent || div.innerText || "";
    } else {
      text = content.replace(/<[^>]*>/g, "");
    }
    
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
    let filtered = notes;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(note => 
        (note.title || "").toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
      );
    }
    
    // Separate pinned and unpinned, then sort
    const pinned = filtered.filter(n => n.pinned);
    const unpinned = filtered.filter(n => !n.pinned);
    
    return [...pinned, ...unpinned];
  }, [notes, searchQuery]);

  if (selectedNoteId) {
    const note = notes.find(n => n.id === selectedNoteId);
    return (
      <NoteEditor
        note={note || null}
        onBack={() => {
          setSelectedNoteId(null);
          loadNotes();
        }}
        onSave={async (title, content, pinned, archived) => {
          if (note) {
            await api.updateGlobalNote(note.id, { title, content, pinned, archived });
          } else {
            const newNote = await api.createGlobalNote({ title, content, pinned, archived });
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
      {/* Onboarding Dialog */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in-0">
          <div className="bg-background rounded-3xl p-6 max-w-md w-full space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Welcome to Notes!</h2>
              <button onClick={() => {
                setShowOnboarding(false);
                localStorage.setItem("notes_onboarding_seen", "true");
              }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-muted-foreground">
              <div className="flex items-start gap-3">
                <Pin className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Pin Important Notes</p>
                  <p className="text-sm">Swipe right or tap the pin icon to keep notes at the top</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Archive className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Archive Notes</p>
                  <p className="text-sm">Swipe left or use the menu to hide notes you don't need right now</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mic className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Voice Notes</p>
                  <p className="text-sm">Record audio directly in your notes</p>
                </div>
              </div>
            </div>
            <Button
              onClick={() => {
                setShowOnboarding(false);
                localStorage.setItem("notes_onboarding_seen", "true");
              }}
              className="w-full rounded-full"
              size="lg"
            >
              Get Started
            </Button>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <h1 className="text-2xl font-sans font-semibold text-foreground">Notes</h1>
              <p className="text-sm text-muted-foreground mt-1">Your thoughts & ideas</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setSelectedNoteId("new")}
                size="lg"
                className="rounded-full gap-2 h-11 px-5"
              >
                <Plus className="w-5 h-5" />
                <span className="font-sans font-medium">New</span>
              </Button>
              <QuickMenu />
            </div>
          </div>
          
          {/* Search and Filters */}
          <div className="space-y-2">
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
            
            {/* Filters Bar */}
            {notes.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-9 w-[140px] rounded-full">
                    <SortAsc className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated_at">Recent</SelectItem>
                    <SelectItem value="created_at">Oldest</SelectItem>
                    <SelectItem value="title">Title A-Z</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  variant={showArchived ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setShowArchived(!showArchived);
                    triggerHaptic("light");
                  }}
                  className="rounded-full gap-2 h-9"
                >
                  <Archive className="w-4 h-4" />
                  {showArchived ? "Hide Archived" : "Show Archived"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes List */}
      <div className="px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-20 animate-in fade-in-0">
            {searchQuery ? (
              <>
                <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6 animate-in zoom-in-95">
                  <Search className="w-10 h-10 text-muted-foreground/50" />
                </div>
                <p className="text-lg text-muted-foreground font-sans mb-2">No notes found</p>
                <p className="text-base text-muted-foreground/70 mb-6">Try adjusting your search or filters</p>
                <Button
                  onClick={() => {
                    setSearchQuery("");
                    triggerHaptic("light");
                  }}
                  variant="outline"
                  size="lg"
                  className="rounded-full"
                >
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6 animate-in zoom-in-95">
                  <FileText className="w-10 h-10 text-muted-foreground/50" />
                </div>
                <p className="text-xl text-foreground font-sans font-medium mb-2">No notes yet</p>
                <p className="text-base text-muted-foreground mb-4">Start capturing your thoughts and ideas</p>
                <p className="text-sm text-muted-foreground/70 mb-8">Swipe down from the top or tap the New button to create your first note</p>
                <Button
                  onClick={() => {
                    setSelectedNoteId("new");
                    triggerHaptic("light");
                  }}
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
              <div
                key={note.id}
                onTouchStart={(e) => handleTouchStart(e, note.id)}
                onTouchMove={(e) => handleTouchMove(e, note.id)}
                onTouchEnd={(e) => handleTouchEnd(e, note.id)}
                className="transition-transform duration-300 ease-out"
              >
                <button
                  onClick={() => {
                    setSelectedNoteId(note.id);
                    triggerHaptic("light");
                  }}
                  className={cn(
                    "w-full text-left p-5 rounded-2xl bg-card hover:bg-muted/50 border border-border/30 transition-all group shadow-sm hover:shadow-md relative",
                    note.pinned && "border-primary/30 bg-primary/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {note.pinned && (
                          <Pin className="w-4 h-4 text-primary shrink-0" fill="currentColor" />
                        )}
                        <h3 className="text-base font-sans font-semibold text-foreground line-clamp-1">
                          {note.title || "Untitled Note"}
                        </h3>
                      </div>
                      
                      {note.image_filename && (
                        <div className="mb-2 rounded-lg overflow-hidden">
                          <img
                            src={api.getNoteImageUrl(note.id)}
                            alt="Note attachment"
                            className="w-full h-32 object-cover"
                          />
                        </div>
                      )}
                      
                      <p className="text-sm font-sans text-muted-foreground whitespace-pre-wrap line-clamp-2 mb-3 leading-relaxed">
                        {getNotePreview(note.content)}
                      </p>
                      
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{formatNoteDate(note.updated_at)}</span>
                        </div>
                        {note.audio_filename && (
                          <div className="flex items-center gap-1">
                            <Mic className="w-4 h-4" />
                            <span>Voice note</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-xl hover:bg-muted shrink-0"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => handlePinNote(note.id, e)}
                          className="flex items-center gap-2"
                        >
                          <Pin className={cn("w-4 h-4", note.pinned && "fill-current")} />
                          {note.pinned ? "Unpin" : "Pin"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleArchiveNote(note.id, e)}
                          className="flex items-center gap-2"
                        >
                          {note.archived ? (
                            <>
                              <ArchiveRestore className="w-4 h-4" />
                              Unarchive
                            </>
                          ) : (
                            <>
                              <Archive className="w-4 h-4" />
                              Archive
                            </>
                          )}
                        </DropdownMenuItem>
                        <div className="h-px bg-border my-1" />
                        <DropdownMenuItem
                          onClick={(e) => handleDeleteNote(note.id, e)}
                          className="flex items-center gap-2 text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
      
      <CoreAIFAB
        messages={coreAI.messages}
        onSendMessage={coreAI.sendMessage}
        onConfirmAction={coreAI.confirmAction}
        isLoading={coreAI.isLoading}
        aiName="SolAI"
        onClearHistory={coreAI.clearHistory}
        currentView="notes"
      />
    </div>
  );
}

interface NoteEditorProps {
  note: GlobalNote | null;
  onBack: () => void;
  onSave: (title: string, content: string, pinned: boolean, archived: boolean) => Promise<void>;
  onDelete?: () => Promise<void>;
}

function NoteEditor({ note, onBack, onSave, onDelete }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const [pinned, setPinned] = useState(note?.pinned || false);
  const [archived, setArchived] = useState(note?.archived || false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(note?.title || "");
    setContent(note?.content || "");
    setPinned(note?.pinned || false);
    setArchived(note?.archived || false);
    setHasUnsavedChanges(false);
    setLastSaved(note ? new Date(note.updated_at) : null);
    
    if (note?.audio_filename) {
      setAudioUrl(api.getNoteAudioUrl(note.id));
    } else {
      setAudioUrl(null);
    }
  }, [note]);

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      await onSave(title.trim() || "Untitled Note", content, pinned, archived);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      triggerHaptic("light");
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
      title.trim() !== (note?.title || "").trim() ||
      pinned !== (note?.pinned || false) ||
      archived !== (note?.archived || false)
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
      content !== (note?.content || "") ||
      pinned !== (note?.pinned || false) ||
      archived !== (note?.archived || false)
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


  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !note) return;
    
    try {
      await api.uploadNoteImage(note.id, file);
      triggerHaptic("medium");
      // Reload note to get updated image
      window.location.reload();
    } catch (error) {
      console.error("Failed to upload image:", error);
      alert("Failed to upload image");
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !note) return;
    
    try {
      await api.uploadNoteAudio(note.id, file);
      triggerHaptic("medium");
      setAudioUrl(api.getNoteAudioUrl(note.id));
    } catch (error) {
      console.error("Failed to upload audio:", error);
      alert("Failed to upload audio");
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([blob], "recording.webm", { type: "audio/webm" });
        if (note) {
          await api.uploadNoteAudio(note.id, file);
          setAudioUrl(api.getNoteAudioUrl(note.id));
        }
        stream.getTracks().forEach(track => track.stop());
        triggerHaptic("medium");
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      triggerHaptic("light");
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Failed to access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
    triggerHaptic("light");
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
    <div className="min-h-screen bg-background flex flex-col pb-20 animate-in fade-in-0">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 shrink-0">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-3">
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
            
            <div className="flex items-center gap-2">
              <Button
                variant={pinned ? "default" : "ghost"}
                size="icon"
                onClick={() => {
                  setPinned(!pinned);
                  triggerHaptic("light");
                }}
                className="rounded-full h-9 w-9"
              >
                <Pin className={cn("w-4 h-4", pinned && "fill-current")} />
              </Button>
              
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
              <QuickMenu />
            </div>
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
        {/* Image Display */}
        {note?.image_filename && (
          <div className="mb-4 rounded-lg overflow-hidden">
            <img
              src={api.getNoteImageUrl(note.id)}
              alt="Note attachment"
              className="w-full max-h-64 object-cover"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (note) {
                  await api.deleteNoteImage(note.id);
                  window.location.reload();
                }
              }}
              className="mt-2 text-destructive"
            >
              Remove image
            </Button>
          </div>
        )}
        
        {/* Audio Player */}
        {audioUrl && (
          <div className="mb-4 p-3 bg-muted/30 rounded-xl flex items-center gap-3">
            <button
              onClick={togglePlayback}
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <div className="flex-1">
              <p className="text-sm font-medium">Voice note</p>
              <p className="text-xs text-muted-foreground">Tap to play</p>
            </div>
            {note && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await api.deleteNoteAudio(note.id);
                  setAudioUrl(null);
                }}
                className="text-destructive"
              >
                Remove
              </Button>
            )}
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          </div>
        )}
        
        <RichTextEditor
          content={content}
          onChange={handleContentChange}
          placeholder="Start writing your thoughts..."
          autoFocus={!note}
          className="h-full min-h-[400px]"
        />
        
        {/* Attachment Buttons */}
        <div className="mt-4 flex items-center gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleAudioUpload}
            className="hidden"
          />
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => imageInputRef.current?.click()}
            className="rounded-full gap-2"
            disabled={!note}
          >
            <ImageIcon className="w-4 h-4" />
            Image
          </Button>
          
          {note && (
            <>
              {isRecording ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={stopRecording}
                  className="rounded-full gap-2"
                >
                  <MicOff className="w-4 h-4" />
                  Stop
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startRecording}
                  className="rounded-full gap-2"
                >
                  <Mic className="w-4 h-4" />
                  Record
                </Button>
              )}
            </>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full gap-2"
            disabled={!note}
          >
            <Mic className="w-4 h-4" />
            Upload Audio
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
