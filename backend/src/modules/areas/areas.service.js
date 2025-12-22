// backend/src/modules/areas/areas.service.js
import prisma from "../../db.js";

export async function createArea({ name, description }) {
  if (!name) {
    throw new Error("El nombre del salón/área es obligatorio");
  }

  const area = await prisma.area.create({
    data: { name, description },
  });

  return area;
}

export async function listAreas() {
  const areas = await prisma.area.findMany({
    where: { isActive: true },
    include: {
      tables: true, // Para ver también las mesas de cada área
    },
  });

  return areas;
}
