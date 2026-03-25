// Global undo/redo stack for calendar event operations (module-level singleton)

export interface EventSnapshot {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string | null
  projectId: string | null
  taskId: string | null
  isFluid: boolean
}

type UndoAction = {
  type: 'delete'
  snapshot: EventSnapshot
}

const undoStack: UndoAction[] = []
const redoStack: UndoAction[] = []

const listeners: Set<() => void> = new Set()

function notify() {
  listeners.forEach(fn => fn())
}

export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export async function deleteEvent(eventId: string): Promise<boolean> {
  try {
    // Fetch full event data before deleting
    const res = await fetch(`/api/events/${eventId}`)
    if (!res.ok) return false
    const event = await res.json()

    const snapshot: EventSnapshot = {
      id: event.id,
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      projectId: event.projectId,
      taskId: event.taskId,
      isFluid: event.isFluid ?? false,
    }

    const delRes = await fetch(`/api/events/${eventId}`, { method: 'DELETE' })
    if (!delRes.ok) return false

    undoStack.push({ type: 'delete', snapshot })
    redoStack.length = 0 // Clear redo on new action
    notify()
    return true
  } catch {
    return false
  }
}

export async function undo(): Promise<boolean> {
  const action = undoStack.pop()
  if (!action) return false

  if (action.type === 'delete') {
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: action.snapshot.title,
          description: action.snapshot.description,
          startTime: action.snapshot.startTime,
          endTime: action.snapshot.endTime,
          projectId: action.snapshot.projectId,
          taskId: action.snapshot.taskId,
          isFluid: action.snapshot.isFluid,
        })
      })
      if (!res.ok) { undoStack.push(action); return false }

      const recreated = await res.json()
      // Update the snapshot ID to the newly created event's ID
      action.snapshot.id = recreated.id
      redoStack.push(action)
      notify()
      return true
    } catch {
      undoStack.push(action)
      return false
    }
  }

  return false
}

export async function redo(): Promise<boolean> {
  const action = redoStack.pop()
  if (!action) return false

  if (action.type === 'delete') {
    try {
      const delRes = await fetch(`/api/events/${action.snapshot.id}`, { method: 'DELETE' })
      if (!delRes.ok) { redoStack.push(action); return false }

      undoStack.push(action)
      notify()
      return true
    } catch {
      redoStack.push(action)
      return false
    }
  }

  return false
}

export function canUndo(): boolean { return undoStack.length > 0 }
export function canRedo(): boolean { return redoStack.length > 0 }
export function getLastUndoLabel(): string | null {
  const last = undoStack[undoStack.length - 1]
  return last ? `Deleted "${last.snapshot.title}"` : null
}
