import { createClient } from '@libsql/client'
import fs from 'fs'

const client = createClient({ url: 'file:dev.db' })

async function dump() {
  console.log('Extracting data directly from SQLite (bypassing Prisma)...')
  
  const extractTable = async (tableName) => {
    try {
      const rs = await client.execute(`SELECT * FROM ${tableName}`)
      // Convert @libsql/client rows to normal objects
      return rs.rows.map(row => {
        const obj = {}
        for (let i = 0; i < rs.columns.length; i++) {
          let val = row[i]
          // Date formatting workaround if needed, but Prisma seed handles ISO strings.
          // Libsql returns strings or numbers for dates.
          obj[rs.columns[i]] = val
        }
        return obj
      })
    } catch (e) {
      console.warn(`Table ${tableName} might be empty or missing. Error: ${e.message}`)
      return []
    }
  }

  const projects = await extractTable('Project')
  const tags = await extractTable('Tag')
  const tasks = await extractTable('Task')
  const subtasks = await extractTable('Subtask')
  const events = await extractTable('Event')
  const journalEntries = await extractTable('JournalEntry')

  // Data conversion for Dates -> Prisma prefers proper ISO strings
  const parseDates = (item, dateFields) => {
    for (const field of dateFields) {
      if (item[field] && typeof item[field] === 'number') {
        item[field] = new Date(item[field]).toISOString()
      } else if (item[field] && typeof item[field] === 'string') {
        // If it's something like "2026-04-16 12:00:00" or ISO already
        if (!item[field].includes('T') && item[field].includes(' ')) {
           item[field] = new Date(item[field]).toISOString()
        }
      }
    }
  }

  [projects, tags, tasks, subtasks, events].forEach(arr => {
    arr.forEach(item => parseDates(item, ['createdAt', 'updatedAt', 'startTime', 'endTime', 'dueDate', 'startDate', 'endDate']))
  })

  // Booleans might be 0/1 in SQLite, convert them:
  tasks.forEach(t => {
     if (t.isCompleted !== undefined) t.isCompleted = !!t.isCompleted
     // ... check other bools.
  })
  events.forEach(e => {
     if (e.isAllDay !== undefined) e.isAllDay = !!e.isAllDay
     if (e.isFluid !== undefined) e.isFluid = !!e.isFluid
  })
  subtasks.forEach(st => {
     if (st.isCompleted !== undefined) st.isCompleted = !!st.isCompleted
  })

  // Clean _foreign keys if they exist physically? No, sqlite output exactly matches model keys.
  const data = {
    projects,
    tags,
    tasks,
    subtasks,
    events,
    journalEntries
  }

  fs.writeFileSync('db_dump.json', JSON.stringify(data, null, 2))
  console.log('✅ Success! Extracted your database into db_dump.json')
}

dump()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
