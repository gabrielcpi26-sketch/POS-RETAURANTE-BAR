// backend/src/modules/tables/tables.service.js
import prisma from "../../db.js";

export async function createTable({ name, number, capacity, areaId }) {
  if (!name) throw new Error("El nombre de la mesa es obligatorio");
  if (!areaId) throw new Error("El área (salón) es obligatorio");

  const area = await prisma.area.findUnique({
    where: { id: Number(areaId) },
  });

  if (!area) throw new Error("El área indicada no existe");

  const table = await prisma.table.create({
    data: {
      name,
      number: number ? Number(number) : null,
      capacity: capacity ? Number(capacity) : 4,
      areaId: Number(areaId),
    },
  });

  return table;
}

export async function listTablesByArea(areaId) {
  const tables = await prisma.table.findMany({
    where: { areaId: Number(areaId) },
    orderBy: { number: "asc" },
  });

  return tables;
}
