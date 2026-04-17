import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function dump() {
  console.log('Fetching all existing data from SQLite...')
  const projects = await prisma.project.findMany()
  const tags = await prisma.tag.findMany()
  const tasks = await prisma.task.findMany()
  const subtasks = await prisma.subtask.findMany()
  const events = await prisma.event.findMany()
  const journalEntries = await prisma.journalEntry.findMany()

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
  .finally(async () => {
    await prisma.$disconnect()
  })
