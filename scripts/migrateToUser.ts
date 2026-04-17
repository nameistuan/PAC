import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import "dotenv/config";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('--- Starting Migration: Assigning Default User ---')

  // 1. Create the default user
  const defaultUser = await prisma.user.upsert({
    where: { email: 'user@juggle.app' },
    update: {},
    create: {
      name: 'Juggle User',
      email: 'user@juggle.app',
    },
  })

  console.log(`Default User created/found: ${defaultUser.id}`)

  // 2. Update all records that don't have a userId
  const results = await Promise.all([
    prisma.project.updateMany({
      where: { userId: null },
      data: { userId: defaultUser.id },
    }),
    prisma.task.updateMany({
      where: { userId: null },
      data: { userId: defaultUser.id },
    }),
    prisma.event.updateMany({
      where: { userId: null },
      data: { userId: defaultUser.id },
    }),
    prisma.journalEntry.updateMany({
      where: { userId: null },
      data: { userId: defaultUser.id },
    }),
  ])

  console.log(`Updated Projects: ${results[0].count}`)
  console.log(`Updated Tasks: ${results[1].count}`)
  console.log(`Updated Events: ${results[2].count}`)
  console.log(`Updated Journal Entries: ${results[3].count}`)

  console.log('--- Migration Complete! ---')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
