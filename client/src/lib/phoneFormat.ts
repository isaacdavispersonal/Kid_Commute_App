/**
 * Formats a phone number to (123) 456-7890 format as user types
 * @param value - The input value
 * @returns Formatted phone number
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-numeric characters
  const numbers = value.replace(/\D/g, '');
  
  // Format based on length
  if (numbers.length === 0) {
    return '';
  } else if (numbers.length <= 3) {
    return `(${numbers}`;
  } else if (numbers.length <= 6) {
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
  } else {
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
  }
}

/**
 * Strips formatting from phone number to get just the digits
 * @param value - The formatted phone number
 * @returns Just the numeric digits
 */
export function stripPhoneFormat(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Validates that a phone number has 10 digits
 * @param value - The phone number (formatted or unformatted)
 * @returns True if valid
 */
export function isValidPhoneNumber(value: string): boolean {
  const numbers = stripPhoneFormat(value);
  return numbers.length === 10;
}
