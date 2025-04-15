import React from 'react';
import Image from 'next/image';
import { MediaData } from '@/app/types'; // Adjust path if needed
import { Star, Users, Clock } from 'lucide-react';

interface MediaCardProps {
  // Ensure MediaData includes an id property
  data: MediaData & { id: number }; 
}

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'; 

// Helper to format runtime (minutes to Xh Ym)
const formatRuntime = (minutes: number | null | undefined): string | null => {
  // ... (your existing formatRuntime function) ...
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
    ? new Date(releaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) 
    : 'N/A';
  const genres = data.genres || [];
  const cast = data.cast || [];
  const runtimeString = formatRuntime(data.runtime);
  
  // --- UPDATED: Construct detailsLink based on mediaType --- 
  const titleSlug = slugify(title);
  const mediaPath = data.mediaType === 'tv' ? 'tv' : 'movie'; // Determine path segment
  const detailsLink = `https://displayr.vercel.app/${mediaPath}/${data.id}-${titleSlug}`; 
  // --- End Update ---

  return (
    // ... your existing JSX ...
    <div className="bg-gradient-to-br from-neutral-100 via-white to-neutral-50 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900 border border-neutral-200/50 dark:border-neutral-800/50 backdrop-blur-sm rounded-xl overflow-hidden my-2 w-full p-3 sm:p-4"> 
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
        <div className="w-full sm:w-1/4 md:w-1/5 flex-shrink-0 bg-slate-200 dark:bg-slate-800 rounded-xl overflow-hidden"> 
          <Image 
            src={posterUrl}
            alt={`${title} Poster`}
            width={150} 
            height={225} 
            className="object-cover h-auto w-full"
            unoptimized
            onError={(e) => { e.currentTarget.src = '/placeholder-image.png'; }}
          />
        </div>
        
        <div className="w-full sm:w-3/4 md:w-4/5 flex flex-col">
          <div className="flex-grow"> 
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2" title={title}>
              {title}
            </h3>
            <div className="flex items-center flex-wrap text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-3 gap-x-3 gap-y-1.5"> 
              <span className="inline-block px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-[10px] sm:text-xs font-medium capitalize">
                {data.mediaType} 
              </span>
              <div className="flex items-center">
                <Star className="w-3.5 h-3.5 text-yellow-400 dark:text-yellow-500 mr-1 flex-shrink-0" fill="currentColor" />
                <span>{rating}</span>
              </div>
              <div className="flex items-center">
                <span>{formattedDate}</span>
              </div>
              {runtimeString && (
                <div className="flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1 opacity-80" />
                  <span>{runtimeString}</span>
                </div>
              )}
            </div>
            {genres.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {genres.map((genre) => (
                  <span 
                    key={genre.id} 
                    className="px-2.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-[10px] sm:text-xs font-medium"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>
            )}
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 line-clamp-3 sm:line-clamp-4"> 
              {overview || 'No overview available.'}
            </p>
            {cast.length > 0 && (
              <div className="flex items-start text-sm text-slate-500 dark:text-slate-400 mb-3">
                <Users className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0 opacity-80" /> 
                <span className="line-clamp-1"> 
                   <span className="font-medium text-slate-600 dark:text-slate-300 mr-1">Cast:</span> 
                   {cast.map(actor => actor.name).join(', ' )}
                </span>
              </div>
            )}
          </div>
          <div className="mt-auto text-right pt-2"> 
            <a
              href={detailsLink} 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-neutral-600 hover:bg-neutral-700 dark:bg-neutral-500 dark:text-gray-100 dark:hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-neutral-500"
            >
              More Details
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaCard; 