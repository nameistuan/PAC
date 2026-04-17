import { PrismaClient } from '@prisma/client'
try {
  const prisma = new PrismaClient({ log: ['info'] })
  console.log("Success with log options")
} catch (e) {
  console.log(e.message)
}
