/**
 * Occurrence Generator Service
 * 
 * Generates occurrences from a recurrence rule for a given date range.
 * Handles daily, weekly, monthly, and yearly recurrence patterns.
 */

import type { Recurrence } from '../entities/Appointment.js';

export interface OccurrenceDate {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}

/**
 * Generate occurrences for a recurrence rule within a date range
 */
export function generateOccurrences(
  recurrence: Recurrence,
  baseDate: string, // YYYY-MM-DD - start date of the recurring appointment
  baseTime: string, // HH:MM - time of the recurring appointment
  fromDate: string, // YYYY-MM-DD - start of range to generate
  toDate: string,   // YYYY-MM-DD - end of range to generate
): OccurrenceDate[] {
  if (recurrence.frequency === 'none') {
    return [];
  }

  const occurrences: OccurrenceDate[] = [];
  const start = new Date(baseDate);
  const from = new Date(fromDate);
  const to = new Date(toDate);
  
  // Determine end date for recurrence
  let endDate: Date | null = null;
  if (recurrence.endDate) {
    endDate = new Date(recurrence.endDate);
  }

  let current = new Date(Math.max(start.getTime(), from.getTime()));
  let occurrenceCount = 0;
  const maxOccurrences = recurrence.occurrences || Infinity;

  // Safety limit to prevent infinite loops
  const MAX_ITERATIONS = 1000;
  let iterations = 0;

  while (current <= to && occurrenceCount < maxOccurrences && iterations < MAX_ITERATIONS) {
    iterations++;

    // Check if we've passed the end date
    if (endDate && current > endDate) {
      break;
    }

    // Check if this occurrence should be included based on frequency
    if (shouldIncludeOccurrence(current, start, recurrence)) {
      if (current >= from) {
        occurrences.push({
          date: formatDate(current),
          time: baseTime,
        });
        occurrenceCount++;
      }
    }

    // Move to next potential occurrence
    current = getNextDate(current, recurrence);
  }

  return occurrences;
}

/**
 * Check if a date should be included based on the recurrence rule
 */
function shouldIncludeOccurrence(
  date: Date,
  startDate: Date,
  recurrence: Recurrence,
): boolean {
  switch (recurrence.frequency) {
    case 'daily':
      return isDailyOccurrence(date, startDate, recurrence.interval);
    
    case 'weekly':
      return isWeeklyOccurrence(date, startDate, recurrence.interval, recurrence.daysOfWeek);
    
    case 'monthly':
      return isMonthlyOccurrence(date, startDate, recurrence.interval, recurrence.dayOfMonth);
    
    case 'yearly':
      return isYearlyOccurrence(date, startDate, recurrence.interval);
    
    default:
      return false;
  }
}

/**
 * Check if date is a valid daily occurrence
 */
function isDailyOccurrence(date: Date, startDate: Date, interval: number): boolean {
  const daysDiff = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff >= 0 && daysDiff % interval === 0;
}

/**
 * Check if date is a valid weekly occurrence
 */
function isWeeklyOccurrence(
  date: Date,
  startDate: Date,
  interval: number,
  daysOfWeek?: number[],
): boolean {
  const weeksDiff = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
  
  if (weeksDiff < 0 || weeksDiff % interval !== 0) {
    return false;
  }

  // If specific days of week are set, check them
  if (daysOfWeek && daysOfWeek.length > 0) {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    return daysOfWeek.includes(dayOfWeek);
  }

  // Otherwise, match the same day of week as start date
  return date.getDay() === startDate.getDay();
}

/**
 * Check if date is a valid monthly occurrence
 */
function isMonthlyOccurrence(
  date: Date,
  startDate: Date,
  interval: number,
  dayOfMonth?: number,
): boolean {
  const monthsDiff = 
    (date.getFullYear() - startDate.getFullYear()) * 12 +
    (date.getMonth() - startDate.getMonth());
  
  if (monthsDiff < 0 || monthsDiff % interval !== 0) {
    return false;
  }

  // Check if it's the correct day of the month
  const targetDay = dayOfMonth || startDate.getDate();
  return date.getDate() === targetDay;
}

/**
 * Check if date is a valid yearly occurrence
 */
function isYearlyOccurrence(date: Date, startDate: Date, interval: number): boolean {
  const yearsDiff = date.getFullYear() - startDate.getFullYear();
  
  if (yearsDiff < 0 || yearsDiff % interval !== 0) {
    return false;
  }

  // Same month and day as start date
  return (
    date.getMonth() === startDate.getMonth() &&
    date.getDate() === startDate.getDate()
  );
}

/**
 * Get the next potential occurrence date based on frequency
 */
function getNextDate(current: Date, recurrence: Recurrence): Date {
  const next = new Date(current);

  switch (recurrence.frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    
    case 'weekly':
      // If specific days of week, increment by 1 day
      // Otherwise, increment by interval weeks
      if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
        next.setDate(next.getDate() + 1);
      } else {
        next.setDate(next.getDate() + (7 * recurrence.interval));
      }
      break;
    
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  return next;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
