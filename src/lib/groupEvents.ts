import { EventSegment } from './calendarEngine';

export type EventWithLayout<T extends { id: string; startTime: Date; endTime: Date }> = T & {
  assignedLeft: string;
  isLayoutIndented: boolean;
  zIndex: number;
};

/**
 * Calculates the horizontal positioning (clustering) for a set of events that share a column.
 * Works with any object that has id, startTime, and endTime.
 */
export function calculateEventLayout<T extends { id: string; startTime: Date; endTime: Date }>(
  events: T[]
): EventWithLayout<T>[] {
  if (events.length === 0) return [];

  // Sort events by start time, then end time (longest first)
  const sortedEvents = [...events].sort((a, b) => {
    const aStart = a.startTime.getTime();
    const bStart = b.startTime.getTime();
    if (aStart !== bStart) return aStart - bStart;
    
    const aEnd = a.endTime.getTime();
    const bEnd = b.endTime.getTime();
    return bEnd - aEnd;
  });

  const groups: T[][] = [];
  let currentGroup: T[] = [];
  let groupEnd = 0;

  for (const event of sortedEvents) {
    const start = event.startTime.getTime();
    const end = event.endTime.getTime();

    if (currentGroup.length === 0 || start < groupEnd) {
      currentGroup.push(event);
      groupEnd = Math.max(groupEnd, end);
    } else {
      groups.push([...currentGroup]);
      currentGroup = [event];
      groupEnd = end;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  const result: EventWithLayout<T>[] = [];
  let globalZIndex = 1;

  for (const group of groups) {
    const TOLERANCE_MS = 40 * 60000;

    const chainId = new Map<string, number>();
    let nextChainId = 0;
    
    // Assign initial isolated chains
    for (const e of group) chainId.set(e.id, nextChainId++);
    
    // Transitive closure (flood fill) for close overlaps
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const e1 = group[i], e2 = group[j];
        const e1Start = e1.startTime.getTime();
        const e2Start = e2.startTime.getTime();
        
        const e1End = e1.endTime.getTime();
        const e2End = e2.endTime.getTime();
        const overlaps = e1Start < e2End && e1End > e2Start;

        if (overlaps && Math.abs(e1Start - e2Start) <= TOLERANCE_MS) {
          const id1 = chainId.get(e1.id)!;
          const id2 = chainId.get(e2.id)!;
          for (const [k, v] of Array.from(chainId.entries())) {
            if (v === id2) chainId.set(k, id1);
          }
        }
      }
    }

    const layoutState: { event: T; color: number; pixelIndent: number; chain: number; zIndex: number }[] = [];
    const chainMaxColor = new Map<number, number>();

    for (const event of group) {
      const eStart = event.startTime.getTime();
      const eEnd = event.endTime.getTime();
      const myChain = chainId.get(event.id)!;

      let color = 0;
      while(true) {
        const conflict = layoutState.some(o => {
          const oStart = o.event.startTime.getTime();
          const oEnd = o.event.endTime.getTime();
          const overlaps = eStart < oEnd && eEnd > oStart;
          return o.color === color && overlaps && o.chain === myChain;
        });
        if (!conflict) break;
        color++;
      }

      // Calculate cascade if we share a color with an overlapping event from a DIFFERENT chain
      let pixelIndent = 0;
      const cascadingOver = layoutState.filter(o => {
        const oStart = o.event.startTime.getTime();
        const oEnd = o.event.endTime.getTime();
        const overlaps = eStart < oEnd && eEnd > oStart;
        return o.color === color && overlaps;
      });

      if (cascadingOver.length > 0) {
        pixelIndent = Math.max(...cascadingOver.map(o => o.pixelIndent)) + 38;
      }

      layoutState.push({ event, color, pixelIndent, chain: myChain, zIndex: globalZIndex++ });
      chainMaxColor.set(myChain, Math.max(chainMaxColor.get(myChain) || 0, color + 1));
    }

    for (const item of layoutState) {
      const cols = chainMaxColor.get(item.chain)!;
      const baseFraction = item.color / cols;
      result.push({
        ...item.event,
        assignedLeft: `calc(${baseFraction * 100}% + ${item.pixelIndent}px + 2px)`,
        isLayoutIndented: baseFraction > 0 || item.pixelIndent > 0,
        zIndex: item.zIndex
      });
    }
  }

  return result;
}
