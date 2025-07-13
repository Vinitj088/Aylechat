import React from 'react';
import Image from 'next/image';
import { MediaData } from '@/app/types'; // Adjust path if needed
import { Star, Clock, Tv, Film } from 'lucide-react';

interface MediaCardProps {
  // Ensure MediaData includes an id property
  data: MediaData & { id: number }; 
}

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'; 

// Helper to format runtime (minutes to Xh Ym)
const formatRuntime = (minutes: number | null | undefined): string | null => {
  if (minutes === null || minutes === undefined || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  let formatted = '';
  if (hours > 0) formatted += `${hours}h`;
  if (remainingMinutes > 0) formatted += ` ${remainingMinutes}m`;
  return formatted.trim();
};

// --- NEW: Slugify function ---
const slugify = (text: string): string => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars except -
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
};
// --- End Slugify function ---

const MediaCard: React.FC<MediaCardProps> = ({ data }) => {
  const title = data.title;
  const overview = data.overview;
  const posterUrl = data.posterPath ? `${TMDB_IMAGE_BASE_URL}${data.posterPath}` : '/placeholder-image.png';
  const rating = data.voteAverage ? data.voteAverage.toFixed(1) : 'N/A';
  const releaseDate = data.mediaType === 'movie' ? data.releaseDate : data.firstAirDate;
  const formattedDate = releaseDate 
    ? new Date(releaseDate).toLocaleDateString('en-US', { year: 'numeric' })
    : 'N/A';
  const genres = data.genres || [];
  const cast = data.cast || [];
  const runtimeString = formatRuntime(data.runtime);
  
  // --- UPDATED: Construct detailsLink based on mediaType --- 
  const titleSlug = slugify(title);
  const mediaPath = data.mediaType === 'tv' ? 'tv' : 'movies'; // Determine path segment
  const detailsLink = `https://www.themoviedb.org/${mediaPath}/${data.id}`;  // --- End Update ---

  return (
    <div className="w-full bg-card text-card-foreground border border-border rounded-xl p-4 my-2 flex flex-col sm:flex-row gap-6 shadow-lg">
      {/* Poster */}
      <div className="w-full sm:w-1/3 md:w-1/4 flex-shrink-0">
        <div className="aspect-[2/3] bg-muted rounded-xl overflow-hidden shadow-lg group relative   transform-gpu hover:scale-105 hover:shadow-2xl">
          <Image 
            src={posterUrl}
            alt={`${title} Poster`}
            width={200} 
            height={300} 
            className="object-cover h-full w-full"
            unoptimized
            onError={(e) => { e.currentTarget.src = '/placeholder-image.png'; }}
          />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-all duration-300"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10"></div>
           <div className="absolute top-0 left-[-100%] h-full w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:left-[100%] transition-all duration-700 delay-100 opacity-80 group-hover:opacity-100"></div>
        </div>
      </div>
      
      {/* Details */}
      <div className="flex-grow flex flex-col justify-between gap-4">
        {/* Top part: Title, meta, overview, genres */}
        <div className="animate-fade-in" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
          <h3 className="text-2xl font-bold text-foreground mb-1.5">{title}</h3>
          <div className="flex items-center text-sm text-muted-foreground mb-4 space-x-2.5">
            {data.mediaType === 'movie' 
              ? <Film className="w-4 h-4" /> 
              : <Tv className="w-4 h-4" />}
            <span className="font-medium">{formattedDate}</span>
            {runtimeString && <><span>&bull;</span><span>{runtimeString}</span></>}
          </div>
          <p className="text-sm text-muted-foreground mb-4 line-clamp-3 leading-relaxed">{overview || 'No overview available.'}</p>
          <div className="flex flex-wrap gap-2">
            {genres.slice(0, 3).map(genre => (
              <span key={genre.id} className="px-3 py-1 bg-secondary border border-border text-secondary-foreground rounded-full text-xs font-medium">
                {genre.name}
              </span>
            ))}
          </div>
        </div>
        
        {/* Bottom part: Cast, rating, button */}
        <div className="space-y-4 animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
          {cast.length > 0 && (
            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Starring</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {cast.slice(0, 4).map(actor => (
                  <div key={actor.id}>
                    <p className="text-sm font-semibold text-foreground truncate">{actor.name}</p>
                    <p className="text-xs text-muted-foreground truncate">as {actor.character}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" fill="currentColor" />
              <span className="text-xl font-bold text-foreground">{rating}</span>
              <span className="text-sm text-muted-foreground pt-0.5">/ 10</span>
            </div>
            <a
              href={detailsLink} 
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2  "
            >
              <span>More Details</span>
              <svg className="w-4 h-4 ml-1.5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaCard; 