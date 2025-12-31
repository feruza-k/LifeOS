import { format, parseISO } from "date-fns";
import { Image } from "lucide-react";

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

  return (
    <div className="grid gap-3 grid-cols-2">
      {/* Photo Album */}
      <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
        {currentPhoto && (
          <img
            key={`${currentPhoto.filename}-${currentPhoto.date}-${currentIndex}`}
            src={`${currentPhoto.url}?t=${Date.now()}&date=${currentPhoto.date}`}
            alt={`Weekly photo from ${format(parseISO(currentPhoto.date), "MMM d")}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const baseUrl = currentPhoto.url.split('?')[0];
              if (target.src !== baseUrl) {
                target.src = `${baseUrl}?date=${currentPhoto.date}`;
              } else {
                // Reload photos after a short delay
                setTimeout(() => {
                  onReload();
                }, 1000);
              }
            }}
          />
        )}
        {photos.length > 1 && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
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
      
      {/* Reflection Note */}
      <div className="relative aspect-square flex items-center justify-center">
        {currentPhoto?.note ? (
          <p 
            className="text-sm text-foreground font-handwriting italic leading-relaxed text-center px-3" 
            style={{ fontFamily: "'Dancing Script', 'Kalam', cursive" }}
          >
            {displayedNote}
            {displayedNote.length < (currentPhoto.note?.length || 0) && (
              <span className="inline-block w-0.5 h-4 bg-foreground ml-0.5 animate-pulse" />
            )}
          </p>
        ) : (
          <p 
            className="text-sm text-muted-foreground font-handwriting italic leading-relaxed text-center px-3" 
            style={{ fontFamily: "'Dancing Script', 'Kalam', cursive" }}
          >
            No reflection for this moment
          </p>
        )}
      </div>
    </div>
  );
}

