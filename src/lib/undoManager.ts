// Global undo/redo stack for calendar event operations (module-level singleton)

export interface EventSnapshot {
  id: string
  title: string
  description: string | null
  location: string | null
  startTime: string
  endTime: string | null
  projectId: string | null
  taskId: string | null
  isFluid: boolean
}

type UndoAction =
  | { type: 'delete'; snapshot: EventSnapshot }
  | { type: 'update'; eventId: string; before: EventSnapshot; after: Partial<EventSnapshot> }
  | { type: 'create'; snapshot: EventSnapshot }

const undoStack: UndoAction[] = []
const redoStack: UndoAction[] = []

// ── Helpers ──

async function fetchSnapshot(eventId: string): Promise<EventSnapshot | null> {
  try {
    const res = await fetch(`/api/events/${eventId}`)
    if (!res.ok) return null
    const e = await res.json()
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      location: e.location,
      startTime: e.startTime,
      endTime: e.endTime,
      projectId: e.projectId,
      taskId: e.taskId,
      isFluid: e.isFluid ?? false,
    }
  } catch { return null }
}

async function applyUpdate(eventId: string, data: Partial<EventSnapshot>): Promise<boolean> {
  try {
    const res = await fetch(`/api/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.ok
  } catch { return false }
}

async function recreateEvent(snap: EventSnapshot): Promise<string | null> {
  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: snap.title,
        description: snap.description,
        location: snap.location,
        startTime: snap.startTime,
        endTime: snap.endTime,
        projectId: snap.projectId,
        taskId: snap.taskId,
        isFluid: snap.isFluid,
      })
    })
    if (!res.ok) return null
    const created = await res.json()
    return created.id as string
  } catch { return null }
}

async function apiDelete(eventId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' })
    return res.ok
  } catch { return false }
}

function clearRedo() { redoStack.length = 0 }

function notifyDelete(eventId: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pac-event-deleted', { detail: eventId }))
  }
}


// ── Public API ──

/** Snapshot + delete an event. Returns the event title on success. */
export async function deleteEvent(eventId: string): Promise<string | false> {
  const snapshot = await fetchSnapshot(eventId)
  if (!snapshot) return false
  if (!(await apiDelete(eventId))) return false
  notifyDelete(eventId)
  undoStack.push({ type: 'delete', snapshot })
  clearRedo()
  return snapshot.title
}

/** Snapshot before an update, then apply it. Call BEFORE the fetch. */
export async function updateEvent(
  eventId: string,
  newData: Partial<EventSnapshot>
): Promise<string | false> {
  const before = await fetchSnapshot(eventId)
  if (!before) return false
  if (!(await applyUpdate(eventId, newData))) return false
  undoStack.push({ type: 'update', eventId, before, after: newData })
  clearRedo()
  return before.title
}

/** Create a new event from scratch. Returns the new ID or false on failure. */
export async function createEvent(
  data: Omit<EventSnapshot, 'id'>
): Promise<string | false> {
  const newId = await recreateEvent({ ...data, id: '' })
  if (!newId) return false
  const snapshot: EventSnapshot = { ...data, id: newId }
  undoStack.push({ type: 'create', snapshot })
  clearRedo()
  return newId
}

/** Record a newly created event so it can be undone (deleted). */
export function pushCreate(snapshot: EventSnapshot) {
  undoStack.push({ type: 'create', snapshot })
  clearRedo()
}

/** Undo the last action. Returns a label string on success. */
export async function undo(): Promise<string | false> {
  const action = undoStack.pop()
  if (!action) return false

  try {
    if (action.type === 'delete') {
      const newId = await recreateEvent(action.snapshot)
      if (!newId) { undoStack.push(action); return false }
      action.snapshot.id = newId
      redoStack.push(action)
      return `Restored "${action.snapshot.title}"`
    }

    if (action.type === 'update') {
      // Revert to the "before" state
      const revertData: Partial<EventSnapshot> = {}
      for (const key of Object.keys(action.after) as (keyof EventSnapshot)[]) {
        (revertData as any)[key] = action.before[key]
      }
      if (!(await applyUpdate(action.eventId, revertData))) { undoStack.push(action); return false }
      redoStack.push(action)
      return `Reverted "${action.before.title}"`
    }

    if (action.type === 'create') {
      if (!(await apiDelete(action.snapshot.id))) { undoStack.push(action); return false }
      notifyDelete(action.snapshot.id)
      redoStack.push(action)
      return `Removed "${action.snapshot.title}"`
    }
  } catch {
    undoStack.push(action)
    return false
  }

  return false
}

/** Redo the last undone action. Returns a label string on success. */
export async function redo(): Promise<string | false> {
  const action = redoStack.pop()
  if (!action) return false

  try {
    if (action.type === 'delete') {
      if (!(await apiDelete(action.snapshot.id))) { redoStack.push(action); return false }
      notifyDelete(action.snapshot.id)
      undoStack.push(action)
      return `Deleted "${action.snapshot.title}"`
    }

    if (action.type === 'update') {
      if (!(await applyUpdate(action.eventId, action.after))) { redoStack.push(action); return false }
      undoStack.push(action)
      return `Re-applied changes to "${action.before.title}"`
    }

    if (action.type === 'create') {
      const newId = await recreateEvent(action.snapshot)
      if (!newId) { redoStack.push(action); return false }
      action.snapshot.id = newId
      undoStack.push(action)
      return `Re-created "${action.snapshot.title}"`
    }
  } catch {
    redoStack.push(action)
    return false
  }

  return false
}
