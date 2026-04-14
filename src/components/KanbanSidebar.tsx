'use client'

import React, { useEffect, useState, useTransition } from 'react'
import styles from './KanbanSidebar.module.css'
import { getKanbanTasks, updateTaskStatus } from '@/lib/taskActions'

type Task = {
  id: string
  title: string
  status: string
  dueDate?: string | null
  project?: { color: string; name: string } | null
}

const STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE']
const STATUS_LABELS: Record<string, string> = {
  'BACKLOG': 'Backlog',
  'TODO': 'To Do',
  'IN_PROGRESS': 'In Progress',
  'DONE': 'Done'
}

export default function KanbanSidebar() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'BACKLOG': false,
    'TODO': true,
    'IN_PROGRESS': true,
    'DONE': false,
  })
  const [isPending, startTransition] = useTransition()

  const fetchTasks = () => {
    getKanbanTasks().then(data => {
      setTasks(data as any)
    })
  }

  useEffect(() => {
    fetchTasks()
    
    // Listen for custom "task updated" refresh events
    const handleRefresh = () => fetchTasks()
    window.addEventListener('pac-task-updated', handleRefresh)
    return () => window.removeEventListener('pac-task-updated', handleRefresh)
  }, [])

  const toggleSection = (status: string) => {
    setExpanded(prev => ({ ...prev, [status]: !prev[status] }))
  }

  const handleDropToStatus = async (e: React.DragEvent, status: string) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (!taskId) return

    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))

    try {
      await updateTaskStatus(taskId, status)
      fetchTasks()
    } catch (err) {
      console.error('Failed to update task status', err)
      fetchTasks() // Revert on error
    }
  }

  const openTaskModal = (taskId?: string, status?: string) => {
    const params = new URLSearchParams(window.location.search)
    if (taskId) {
      params.set('editTask', taskId)
    } else {
      params.set('create', 'true')
      params.set('modalType', 'task') // Hint for the modal
      if (status) params.set('status', status)
    }
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`)
    // Trigger popstate so AppShell sees the change if necessary, or just use useRouter but we are in a component.
    // Actually, AppShell uses useSearchParams() which listens to URL changes.
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Tasks</h3>
      </div>
      <div className={styles.content}>
        {STATUSES.map(status => {
          const sectionTasks = tasks.filter(t => t.status === status)
          const isExpanded = expanded[status]

          return (
            <div 
              key={status} 
              className={styles.section}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDropToStatus(e, status)}
            >
              <div 
                className={styles.sectionHeader} 
                onClick={() => toggleSection(status)}
              >
                <div className={styles.sectionTitle}>
                  <svg 
                    className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`} 
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                  {STATUS_LABELS[status]}
                  <span className={styles.countBadge}>{sectionTasks.length}</span>
                </div>
                <button 
                  className={styles.addBtn} 
                  onClick={(e) => { e.stopPropagation(); openTaskModal(undefined, status) }}
                  title={`Add task to ${STATUS_LABELS[status]}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                </button>
              </div>
              
              {isExpanded && (
                <div className={styles.taskList}>
                  {sectionTasks.length === 0 ? (
                    <div className={styles.emptyState}>No tasks</div>
                  ) : (
                    sectionTasks.map(task => (
                      <div 
                        key={task.id} 
                        className={styles.taskCard}
                        onClick={() => openTaskModal(task.id)}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('taskId', task.id)
                          e.dataTransfer.setData('taskTitle', task.title)
                          e.dataTransfer.setData('taskColor', task.project?.color || '#3b82f6')
                          
                          // Set global drag variables for the ghost cursor in `InteractiveDayCol`
                          const dragCursorOffsetMs = 0; 
                          const durationMs = 3600000; // 1 hour default
                          ;(window as any).__activeDragCursorOffsetMs = dragCursorOffsetMs
                          ;(window as any).__activeDragDuration = durationMs
                          ;(window as any).__activeDragColor = task.project?.color || '#3b82f6'
                          ;(window as any).__activeDragTitle = task.title
                        }}
                      >
                        <div className={styles.cardHeader}>
                          {task.project && (
                            <div 
                              className={styles.projectPill} 
                              style={{ backgroundColor: `${task.project.color}15`, color: task.project.color }}
                            >
                              {task.project.name}
                            </div>
                          )}
                          {task.dueDate && (
                            <div className={styles.dueDate}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                              {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </div>
                          )}
                        </div>
                        <div className={styles.taskTitle}>{task.title}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
