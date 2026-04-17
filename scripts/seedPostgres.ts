import "dotenv/config"
import prisma from '../src/lib/prisma'
import fs from 'fs'

async function seed() {
  console.log('Reading db_dump.json...')
  if (!fs.existsSync('db_dump.json')) {
    console.error('db_dump.json not found! Please run the dump script first.')
    return
  }

  const fileExtracted = fs.readFileSync('db_dump.json', 'utf-8')
  const data = JSON.parse(fileExtracted)

  console.log('Restoring Projects...')
  await prisma.project.createMany({ data: data.projects })

  console.log('Restoring Tags...')
  await prisma.tag.createMany({ data: data.tags })

  console.log('Restoring Tasks...')
  await prisma.task.createMany({ data: data.tasks })

  console.log('Restoring Subtasks...')
  await prisma.subtask.createMany({ data: data.subtasks })

  console.log('Restoring Events...')
  await prisma.event.createMany({ data: data.events })

  console.log('Restoring Journal Entries...')
  await prisma.journalEntry.createMany({ data: data.journalEntries })

  console.log('✅ Success! Your SQLite database has been successfully migrated to PostgreSQL!')
}

seed()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
