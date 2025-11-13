/**
 * Import Parser Service
 * Parses bulk import text data for stops and students
 */

import type { BulkImportStop, BulkImportStudent } from "@shared/schema";

export interface ParsedStop {
  name: string;
  address: string;
  region?: string;
}

export interface ParsedStudent {
  firstName: string;
  lastName: string;
  notes?: string;
}

export interface StopParseResult {
  success: boolean;
  stops: ParsedStop[];
  errors: string[];
}

export interface StudentParseResult {
  success: boolean;
  students: ParsedStudent[];
  errors: string[];
}

/**
 * Parse stops from text format
 * Expected format: "Name @ Address" or "Name — Location"
 */
export function parseStops(text: string, region?: string): StopParseResult {
  const errors: string[] = [];
  const stops: ParsedStop[] = [];
  
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !line.toLowerCase().includes('valley stops')); // Skip section headers
  
  for (const line of lines) {
    try {
      // Try to match patterns like "Name @ Address" or "Name — Location"
      let name = '';
      let address = '';
      
      if (line.includes(' @ ')) {
        const parts = line.split(' @ ');
        name = parts[0].trim();
        address = parts.slice(1).join(' @ ').trim();
      } else if (line.includes(' — ')) {
        // Handle cases like "Walgreens (MomDoc) — Maricopa"
        const parts = line.split(' — ');
        name = parts[0].trim();
        // For location-only entries, we'll create a simple address
        address = parts.slice(1).join(' — ').trim();
      } else {
        // Single line without delimiter - might be a location name
        name = line;
        address = line; // Use the same value
      }
      
      if (name && address) {
        stops.push({
          name,
          address,
          region,
        });
      } else {
        errors.push(`Could not parse stop: ${line}`);
      }
    } catch (error) {
      errors.push(`Error parsing line "${line}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return {
    success: errors.length === 0,
    stops,
    errors,
  };
}

/**
 * Parse students from text format
 * Expected format: "FirstName LastName" with optional notes in parentheses
 */
export function parseStudents(text: string): StudentParseResult {
  const errors: string[] = [];
  const students: ParsedStudent[] = [];
  
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !line.match(/^[A-Z]–[A-Z]$/)) // Skip section headers like "A–D"
    .filter(line => !line.toLowerCase().includes('all students'))
    .filter(line => !line.toLowerCase().includes('alphabetized'));
  
  for (const line of lines) {
    try {
      let fullName = line;
      let notes = '';
      
      // Extract notes in parentheses
      const notesMatch = line.match(/\((.*?)\)/);
      if (notesMatch) {
        notes = notesMatch[1];
        fullName = line.replace(/\s*\(.*?\)\s*/g, '').trim();
      }
      
      // Split name into first and last
      const nameParts = fullName.trim().split(/\s+/);
      
      if (nameParts.length < 2) {
        errors.push(`Invalid name format (need first and last name): ${line}`);
        continue;
      }
      
      // Handle names with middle names or quotes (like "Richie")
      let firstName = nameParts[0];
      let lastName = nameParts.slice(1).join(' ');
      
      // Remove quotes from names like Richard "Richie" Davis
      firstName = firstName.replace(/['"]/g, '');
      lastName = lastName.replace(/['"]/g, '');
      
      students.push({
        firstName,
        lastName,
        notes: notes || undefined,
      });
    } catch (error) {
      errors.push(`Error parsing line "${line}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return {
    success: errors.length === 0,
    students,
    errors,
  };
}

/**
 * Detect and parse stops with automatic region detection
 */
export function parseStopsWithRegionDetection(text: string): StopParseResult {
  const lines = text.split('\n');
  let currentRegion: string | undefined;
  const allStops: ParsedStop[] = [];
  const allErrors: string[] = [];
  
  let currentSection: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect region headers
    if (trimmed.toLowerCase().includes('east valley stops')) {
      currentRegion = 'East Valley';
      continue;
    } else if (trimmed.toLowerCase().includes('west valley stops')) {
      currentRegion = 'West Valley';
      continue;
    } else if (trimmed.toLowerCase().includes('all students')) {
      // Stop processing when we hit the students section
      break;
    }
    
    if (trimmed.length > 0) {
      currentSection.push(trimmed);
    }
  }
  
  // Parse the collected section
  if (currentSection.length > 0) {
    const result = parseStops(currentSection.join('\n'), currentRegion);
    allStops.push(...result.stops);
    allErrors.push(...result.errors);
  }
  
  return {
    success: allErrors.length === 0,
    stops: allStops,
    errors: allErrors,
  };
}
