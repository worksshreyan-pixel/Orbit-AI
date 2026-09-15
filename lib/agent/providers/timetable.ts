/**
 * Timetable provider — pure TypeScript, no I/O.
 *
 * A user's timetable is stored as a JSON blob in their memories table
 * (category: 'context', with content containing a JSON timetable).
 *
 * Example timetable JSON:
 * {
 *   "monday":    [{ "start": "09:00", "end": "10:30", "title": "OS Lecture", "fixed": true }],
 *   "tuesday":   [],
 *   "wednesday": [{ "start": "14:00", "end": "15:00", "title": "Team Meeting", "fixed": true }],
 *   "thursday":  [],
 *   "friday":    [{ "start": "10:00", "end": "12:00", "title": "Lab", "fixed": true }],
 *   "saturday":  [],
 *   "sunday":    []
 * }
 */

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface TimeSlot {
  start: string;       // "HH:MM" 24-hour
  end: string;         // "HH:MM" 24-hour
  title: string;
  fixed?: boolean;     // if true, ORBIT cannot schedule over this
}

export interface Timetable {
  monday: TimeSlot[];
  tuesday: TimeSlot[];
  wednesday: TimeSlot[];
  thursday: TimeSlot[];
  friday: TimeSlot[];
  saturday: TimeSlot[];
  sunday: TimeSlot[];
}

export interface FreeSlot {
  start: string;
  end: string;
  durationMinutes: number;
}

const DAY_MAP: Record<number, DayOfWeek> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
};

const EMPTY_TIMETABLE: Timetable = {
  monday: [], tuesday: [], wednesday: [], thursday: [],
  friday: [], saturday: [], sunday: [],
};

/** Parse a raw string (from memories.content) into a Timetable. Returns empty timetable on failure. */
export function parseTimetable(raw: string): Timetable {
  try {
    const parsed = JSON.parse(raw);
    // Basic validation
    const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const result: Partial<Timetable> = {};
    for (const day of days) {
      result[day] = Array.isArray(parsed[day])
        ? (parsed[day] as TimeSlot[]).filter(s => typeof s.start === 'string' && typeof s.end === 'string')
        : [];
    }
    return result as Timetable;
  } catch {
    return EMPTY_TIMETABLE;
  }
}

/** Convert "HH:MM" to total minutes since midnight */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Convert minutes since midnight to "HH:MM" */
function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Get the day-of-week name for a given Date */
export function getDayOfWeek(date: Date): DayOfWeek {
  return DAY_MAP[date.getDay()];
}

/**
 * Returns free time slots for a given date (defaulting to today),
 * filling gaps between fixed commitments.
 * Day starts at 08:00 and ends at 22:00 by default.
 */
export function getFreeSlots(
  timetable: Timetable,
  date: Date = new Date(),
  dayStartHour = 8,
  dayEndHour = 22,
): FreeSlot[] {
  const day = getDayOfWeek(date);
  const slots = timetable[day];

  const fixed = slots
    .filter(s => s.fixed !== false)
    .map(s => ({ start: toMinutes(s.start), end: toMinutes(s.end) }))
    .sort((a, b) => a.start - b.start);

  const freeSlots: FreeSlot[] = [];
  let cursor = dayStartHour * 60;
  const dayEnd = dayEndHour * 60;

  for (const commitment of fixed) {
    if (commitment.start > cursor) {
      const duration = commitment.start - cursor;
      if (duration >= 15) { // at least 15 min free
        freeSlots.push({
          start: fromMinutes(cursor),
          end: fromMinutes(commitment.start),
          durationMinutes: duration,
        });
      }
    }
    cursor = Math.max(cursor, commitment.end);
  }

  // Remaining time after last commitment
  if (dayEnd > cursor) {
    const duration = dayEnd - cursor;
    if (duration >= 15) {
      freeSlots.push({
        start: fromMinutes(cursor),
        end: fromMinutes(dayEnd),
        durationMinutes: duration,
      });
    }
  }

  return freeSlots;
}

/**
 * Detects if a proposed session would conflict with any FIXED commitment on that day.
 * Returns the conflicting slot title, or null if safe.
 */
export function detectConflict(
  timetable: Timetable,
  date: Date,
  proposedStart: string,
  proposedEnd: string,
): string | null {
  const day = getDayOfWeek(date);
  const slots = timetable[day].filter(s => s.fixed !== false);

  const pStart = toMinutes(proposedStart);
  const pEnd = toMinutes(proposedEnd);

  for (const slot of slots) {
    const sStart = toMinutes(slot.start);
    const sEnd = toMinutes(slot.end);
    if (pStart < sEnd && pEnd > sStart) {
      return slot.title;
    }
  }
  return null;
}

/** Summarise a timetable day into a human-readable string */
export function summariseDay(timetable: Timetable, date: Date): string {
  const day = getDayOfWeek(date);
  const slots = timetable[day];
  if (slots.length === 0) return 'No fixed commitments.';
  return slots.map(s => `${s.start}–${s.end}: ${s.title}${s.fixed === false ? ' (flexible)' : ' (fixed)'}`).join('\n');
}

/** Total free minutes available on a given date */
export function totalFreeMinutes(timetable: Timetable, date: Date): number {
  return getFreeSlots(timetable, date).reduce((sum, s) => sum + s.durationMinutes, 0);
}
