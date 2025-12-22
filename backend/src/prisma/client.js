// backend/src/prisma/client.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["error"], // si quieres, luego activamos ["query","error"] para ver consultas
});

export default prisma;
