'use client';

import React from 'react';
import { Thermometer, Wind, Droplets } from 'lucide-react';

// Helper to get a weather emoji from Tomorrow.io weather codes
const getWeatherEmoji = (weatherCode: number | string): string => {
  const code = typeof weatherCode === 'string' ? parseInt(weatherCode, 10) : weatherCode;
  
  const weatherMapping: { [key: number]: string } = {
    1000: '☀️', // Clear
    1100: '🌤️', // Mostly Clear
    1101: '⛅️', // Partly Cloudy
    1102: '☁️', // Mostly Cloudy
    1001: '☁️', // Cloudy
    2000: '🌫️', // Fog
    2100: '🌫️', // Light Fog
    4000: '💧', // Drizzle
    4200: '🌧️', // Light Rain
    4001: '🌧️', // Rain
    4201: '⛈️', // Heavy Rain
    5000: '❄️', // Snow
    5001: '❄️', // Flurries
    5100: '🌨️', // Light Snow
    5101: '🌨️', // Heavy Snow
    6000: '🥶', // Freezing Drizzle
    6001: '🥶', // Freezing Rain
    6200: '🥶', // Light Freezing Rain
    6201: '🥶', // Heavy Freezing Rain
    7000: '🧊', // Ice Pellets
    7101: '🧊', // Heavy Ice Pellets
    7102: '🧊', // Light Ice Pellets
    8000: '⚡️', // Thunderstorm
  };
  return weatherMapping[code] || '🌡️'; // Default
};

const WeatherCard = ({ data }: { data: any }) => {
  if (!data || !data.current_condition || !data.weather) {
    return <div className="text-red-500 p-4 rounded-lg bg-red-500/10 w-full">Weather data is not available.</div>;
  }

  const current = data.current_condition[0];
  const today = data.weather[0];
  
  // Use the user's query for the location name, fall back to API's name.
  const locationName = data.display_location || data.location.name;
  // Capitalize the first letter for better presentation.
  const displayLocation = locationName.charAt(0).toUpperCase() + locationName.slice(1);

  return (
    <div className="w-full bg-card border border-border rounded-[var(--radius)] p-5 my-2 backdrop-blur-sm">
      {/* Top Section: Location and Emoji */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-xl font-bold text-foreground">
            {displayLocation}
          </p>
          <p className="text-sm text-muted-foreground">
            {/* Display the full location from API if different from user query */}
            {data.location.name && data.location.name.toLowerCase() !== displayLocation.toLowerCase() ? data.location.name : ''}
          </p>
        </div>
        <div className="text-5xl opacity-80">
          {getWeatherEmoji(current.weatherCode)}
        </div>
      </div>

      {/* Middle Section: Main temperature and description */}
      <div className="flex items-center gap-4 mb-4">
        <p className="text-7xl font-extrabold text-foreground tracking-tighter">
          {current.temp_C}°
        </p>
        <div className="flex flex-col">
            <p className="font-semibold text-lg text-foreground">{current.weatherDesc[0].value}</p>
            <p className="text-sm text-muted-foreground">
                Feels like {current.FeelsLikeC}°C
            </p>
        </div>
      </div>

      {/* Bottom Section: Details Grid */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border text-sm">
        <div className="flex items-center gap-2 text-foreground">
            <Thermometer className="w-4 h-4 text-muted-foreground" />
            <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">H/L</span>
                <span>{today.maxtempC}° / {today.mintempC}°</span>
            </div>
        </div>
        <div className="flex items-center gap-2 text-foreground">
            <Wind className="w-4 h-4 text-muted-foreground" />
             <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Wind</span>
                <span>{current.windspeedKmph} km/h</span>
            </div>
        </div>
        <div className="flex items-center gap-2 text-foreground">
            <Droplets className="w-4 h-4 text-muted-foreground" />
             <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Humidity</span>
                <span>{current.humidity}%</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherCard; 