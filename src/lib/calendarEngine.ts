import { format, addDays, startOfDay, endOfDay, isBefore, isAfter, max, min } from 'date-fns';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: Date;
  endTime: Date;
  projectId?: string | null;
  project?: {
    id: string;
    name: string;
    color: string;
  } | null;
  [key: string]: any;
}

export interface EventSegment extends CalendarEvent {
  displayStart: Date;
  displayEnd: Date;
  isStartClipped: boolean;
  isEndClipped: boolean;
  fullStartTime: Date;
  fullEndTime: Date;
}

/**
 * Robustly slices multi-day events into daily segments for a given view range.
 */
export function prepareEventsForGrid(
  events: CalendarEvent[],
  viewStart: Date,
  viewEnd: Date
): Map<string, EventSegment[]> {
  const dayMap = new Map<string, EventSegment[]>();

  // Initialize the map with every day in the view range
  let current = startOfDay(viewStart);
  while (current < viewEnd) {
    dayMap.set(format(current, 'yyyy-MM-dd'), []);
    current = addDays(current, 1);
  }

  for (const event of events) {
    const eStart = new Date(event.startTime);
    const eEnd = new Date(event.endTime);

    // Iterating through each day to see if the event overlaps
    dayMap.forEach((segments, dateStr) => {
      const [_y, _m, _d] = dateStr.split('-').map(Number);
      const dayStart = new Date(_y, _m - 1, _d, 0, 0, 0, 0);
      const dayEnd = new Date(_y, _m - 1, _d, 23, 59, 59, 999);

      // Intersection check: Start is before day end AND end is after day start
      if (isBefore(eStart, dayEnd) && isAfter(eEnd, dayStart)) {
        const clippedStart = max([eStart, dayStart]);
        const clippedEnd = min([eEnd, new Date(dayEnd.getTime() + 1)]); // Use true midnight of next day for math

        segments.push({
          ...event,
          displayStart: clippedStart,
          displayEnd: clippedEnd,
          isStartClipped: eStart.getTime() < dayStart.getTime(),
          isEndClipped: eEnd.getTime() > dayEnd.getTime() + 1,
          fullStartTime: eStart,
          fullEndTime: eEnd,
          // For compatibility with legacy layout functions if they expect startTime/endTime
          startTime: clippedStart,
          endTime: clippedEnd,
        });
      }
    });
  }

  return dayMap;
}

/**
 * Validates an event interval to prevent "Singularity" bugs (End < Start)
 */
export function validateInterval(start: Date, end: Date): boolean {
  return isBefore(start, end);
}
