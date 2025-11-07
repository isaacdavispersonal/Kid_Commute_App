/**
 * GPS utility functions for distance calculation and ETA estimation
 */

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param lat1 - Latitude of point 1 (decimal degrees)
 * @param lon1 - Longitude of point 1 (decimal degrees)
 * @param lat2 - Latitude of point 2 (decimal degrees)
 * @param lon2 - Longitude of point 2 (decimal degrees)
 * @returns Distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth's radius in miles
  
  // Convert degrees to radians
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate ETA in minutes based on distance and current speed
 * @param distanceMiles - Distance in miles
 * @param speedMph - Current speed in miles per hour (optional, defaults to 25 mph)
 * @returns Estimated time of arrival in minutes
 */
export function calculateETA(distanceMiles: number, speedMph: number = 25): number {
  if (speedMph <= 0) {
    speedMph = 25; // Default to 25 mph if speed is invalid
  }
  
  const hours = distanceMiles / speedMph;
  const minutes = hours * 60;
  
  return Math.round(minutes);
}

/**
 * Format distance for display
 * @param miles - Distance in miles
 * @returns Formatted string (e.g., "2.3 miles", "0.5 miles")
 */
export function formatDistance(miles: number): string {
  return `${miles.toFixed(1)} mile${miles === 1 ? '' : 's'}`;
}

/**
 * Format ETA for display
 * @param minutes - Time in minutes
 * @returns Formatted string (e.g., "12 minutes", "1 minute", "< 1 minute")
 */
export function formatETA(minutes: number): string {
  if (minutes < 1) {
    return '< 1 minute';
  }
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
