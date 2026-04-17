const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany();
  const tags = await prisma.tag.findMany();
  const tasks = await prisma.task.findMany();
  const subtasks = await prisma.subtask.findMany();
  const events = await prisma.event.findMany();
  const journalEntries = await prisma.journalEntry.findMany();

  const data = {
    projects,
    tags,
    tasks,
    subtasks,
    events,
    journalEntries
  };

  fs.writeFileSync('db_dump.json', JSON.stringify(data, null, 2));
  console.log('Successfully dumped database to db_dump.json');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
