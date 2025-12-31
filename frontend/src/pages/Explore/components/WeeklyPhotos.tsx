import { format, parseISO } from "date-fns";
import { Image } from "lucide-react";
import { api } from "@/lib/api";

interface Photo {
  date: string;
  filename: string;
  url: string;
  note?: string;
}

interface WeeklyPhotosProps {
  photos: Photo[];
  currentIndex: number;
  displayedNote: string;
  onIndexChange: (index: number) => void;
  onReload: () => void;
}

export function WeeklyPhotos({
  photos,
  currentIndex,
  displayedNote,
  onIndexChange,
  onReload,
}: WeeklyPhotosProps) {
  const currentPhoto = photos[currentIndex];
  const photoUrl = currentPhoto ? api.getPhotoUrl(currentPhoto.filename) : null;

  return (
    <div className="grid gap-3 grid-cols-2">
      {/* Photo Album */}
      <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
        {currentPhoto && currentPhoto.filename && photoUrl ? (
          <>
            <img
              key={`${currentPhoto.filename}-${currentPhoto.date}-${currentIndex}`}
              src={`${photoUrl}?t=${Date.now()}&date=${currentPhoto.date}`}
              alt={`Weekly photo from ${format(parseISO(currentPhoto.date), "MMM d")}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                // Check if we've already tried fallbacks (check for data attribute)
                const hasTriedFallback = target.dataset.triedFallback === 'true';
                
                if (!hasTriedFallback && target.src.includes('?t=')) {
                  // Try without cache-busting first
                  target.dataset.triedFallback = 'true';
                  target.src = `${photoUrl}?date=${currentPhoto.date}`;
                } else {
                  // If all fails, show placeholder immediately and stop retrying
                  target.style.display = 'none';
                  const placeholder = target.parentElement?.querySelector('.image-placeholder') as HTMLElement;
                  if (placeholder) {
                    placeholder.style.display = 'flex';
                  }
                  // Don't call onReload() - the photo doesn't exist, stop the loop
                }
              }}
              onLoad={(e) => {
                // Hide placeholder when image loads
                const target = e.target as HTMLImageElement;
                const placeholder = target.parentElement?.querySelector('.image-placeholder') as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = 'none';
                }
              }}
            />
            <div className="image-placeholder hidden absolute inset-0 bg-muted/50 flex items-center justify-center">
              <Image className="w-12 h-12 text-muted-foreground/40" />
            </div>
          </>
        ) : (
          // No photo - show camera-shy placeholder
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-muted/30 via-muted/20 to-muted/30">
            <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mb-3">
              <Image className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-xs text-muted-foreground/60 font-sans text-center px-4">
              This was a camera-shy day ✨
            </p>
          </div>
        )}
        {photos.length > 1 && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1 z-10">
            {photos.map((_, index) => (
              <button
                key={index}
                onClick={() => onIndexChange(index)}
                className={`h-1 rounded-full transition-all ${
                  index === currentIndex ? "w-4 bg-white" : "w-1 bg-white/50"
                }`}
                aria-label={`View photo ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Reflection Note - Top Middle */}
      <div className="relative aspect-square flex items-start justify-center pt-6">
        {currentPhoto?.note ? (
          <p 
            className="text-base text-foreground font-handwriting italic leading-relaxed text-center px-4" 
            style={{ fontFamily: "'Dancing Script', 'Kalam', cursive" }}
          >
            {displayedNote}
            {displayedNote.length < (currentPhoto.note?.length || 0) && (
              <span className="inline-block w-0.5 h-4 bg-foreground ml-0.5 animate-pulse" />
            )}
          </p>
        ) : (
          // No reflection - show a thoughtful placeholder
          <div className="text-center px-4">
            <p 
              className="text-base text-muted-foreground font-handwriting italic leading-relaxed" 
              style={{ fontFamily: "'Dancing Script', 'Kalam', cursive" }}
            >
              {currentPhoto?.filename 
                ? "A moment captured, but thoughts left unspoken..."
                : "A day lived, quietly and fully ✨"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

