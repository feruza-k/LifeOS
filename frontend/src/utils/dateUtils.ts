/**
 * Centralized date normalization utilities
 * Ensures all dates are compared as YYYY-MM-DD strings without timezone issues
 */

/**
 * Normalize a date to YYYY-MM-DD format, handling all input types
 * This function is timezone-safe and always returns a pure date string
 */
export function normalizeDate(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  
  if (typeof date === 'string') {
    // Remove time portion if present
    let normalized = date;
    if (normalized.includes('T')) {
      normalized = normalized.split('T')[0];
    } else if (normalized.includes(' ')) {
      normalized = normalized.split(' ')[0];
    }
    // Ensure it's exactly 10 characters (YYYY-MM-DD)
    if (normalized.length > 10) {
      normalized = normalized.substring(0, 10);
    }
    // Validate format
    if (normalized.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return normalized;
    }
    return null;
  }
  
  if (date instanceof Date) {
    // Use local date components to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

/**
 * Compare two dates for equality (ignoring time and timezone)
 */
export function datesEqual(date1: string | Date | null | undefined, date2: string | Date | null | undefined): boolean {
  const normalized1 = normalizeDate(date1);
  const normalized2 = normalizeDate(date2);
  if (!normalized1 || !normalized2) return false;
  return normalized1 === normalized2;
}

