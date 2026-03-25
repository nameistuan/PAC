export type CalendarEventItem = {
  id: string;
  startTime: Date;
  endTime: Date | null;
  [key: string]: any;
};

export type EventWithLayout = CalendarEventItem & {
  assignedLeft: string;
  isLayoutIndented: boolean;
  zIndex: number;
};

export function calculateEventLayout(events: CalendarEventItem[]): EventWithLayout[] {
  // Sort events by start time, then end time (longest first)
  const sortedEvents = [...events].sort((a, b) => {
    const aStart = new Date(a.startTime).getTime();
    const bStart = new Date(b.startTime).getTime();
    if (aStart !== bStart) return aStart - bStart;
    
    const aEnd = a.endTime ? new Date(a.endTime).getTime() : aStart + 3600000;
    const bEnd = b.endTime ? new Date(b.endTime).getTime() : bStart + 3600000;
    return bEnd - aEnd;
  });

  const groups: CalendarEventItem[][] = [];
  let currentGroup: CalendarEventItem[] = [];
  let groupEnd = 0;

  for (const event of sortedEvents) {
    const start = new Date(event.startTime).getTime();
    const end = event.endTime ? new Date(event.endTime).getTime() : start + 3600000;

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

  const result: EventWithLayout[] = [];
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
        const e1Start = new Date(e1.startTime).getTime();
        const e2Start = new Date(e2.startTime).getTime();
        
        // Simple overlap check
        const e1End = e1.endTime ? new Date(e1.endTime).getTime() : e1Start + 3600000;
        const e2End = e2.endTime ? new Date(e2.endTime).getTime() : e2Start + 3600000;
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

    const layoutState: { event: CalendarEventItem; color: number; pixelIndent: number; chain: number; zIndex: number }[] = [];
    const chainMaxColor = new Map<number, number>();

    for (const event of group) {
      const eStart = new Date(event.startTime).getTime();
      const eEnd = event.endTime ? new Date(event.endTime).getTime() : eStart + 3600000;
      const myChain = chainId.get(event.id)!;

      let color = 0;
      while(true) {
        const conflict = layoutState.some(o => {
          const oStart = new Date(o.event.startTime).getTime();
          const oEnd = o.event.endTime ? new Date(o.event.endTime).getTime() : oStart + 3600000;
          const overlaps = eStart < oEnd && eEnd > oStart;
          return o.color === color && overlaps && o.chain === myChain;
        });
        if (!conflict) break;
        color++;
      }

      // Calculate cascade if we share a color with an overlapping event from a DIFFERENT chain
      let pixelIndent = 0;
      const cascadingOver = layoutState.filter(o => {
        const oStart = new Date(o.event.startTime).getTime();
        const oEnd = o.event.endTime ? new Date(o.event.endTime).getTime() : oStart + 3600000;
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
