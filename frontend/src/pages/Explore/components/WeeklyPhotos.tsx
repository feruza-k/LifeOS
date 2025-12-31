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
        {currentPhoto && photoUrl ? (
          <>
            <img
              key={`${currentPhoto.filename}-${currentPhoto.date}-${currentIndex}`}
              src={`${photoUrl}?t=${Date.now()}&date=${currentPhoto.date}`}
              alt={`Weekly photo from ${format(parseISO(currentPhoto.date), "MMM d")}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                // Try without cache-busting first
                if (target.src.includes('?t=')) {
                  target.src = `${photoUrl}?date=${currentPhoto.date}`;
                } else if (target.src !== photoUrl) {
                  // Try just the base URL
                  target.src = photoUrl;
                } else {
                  // If all fails, show placeholder
                  target.style.display = 'none';
                  const placeholder = target.parentElement?.querySelector('.image-placeholder') as HTMLElement;
                  if (placeholder) {
                    placeholder.style.display = 'flex';
                  }
                  // Reload photos after a delay
                  setTimeout(() => {
                    onReload();
                  }, 2000);
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
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
            <Image className="w-12 h-12 text-muted-foreground/40" />
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
          <p 
            className="text-base text-muted-foreground font-handwriting italic leading-relaxed text-center px-4" 
            style={{ fontFamily: "'Dancing Script', 'Kalam', cursive" }}
          >
            No reflection for this moment
          </p>
        )}
      </div>
    </div>
  );
}

