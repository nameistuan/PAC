'use client'

import React, { useEffect, useState, useTransition } from 'react'
import styles from './KanbanSidebar.module.css'
import { getKanbanTasks, updateTaskStatus } from '@/lib/taskActions'

type Task = {
  id: string
  title: string
  status: string
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

  useEffect(() => {
    let active = true
    getKanbanTasks().then(data => {
      if (active) setTasks(data)
    })
    return () => { active = false }
  }, [])

  const toggleSection = (status: string) => {
    setExpanded(prev => ({ ...prev, [status]: !prev[status] }))
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
            <div key={status} className={styles.section}>
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
                        {task.project && (
                          <div 
                            className={styles.projectPill} 
                            style={{ backgroundColor: `${task.project.color}22`, color: task.project.color }}
                          >
                            {task.project.name}
                          </div>
                        )}
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
