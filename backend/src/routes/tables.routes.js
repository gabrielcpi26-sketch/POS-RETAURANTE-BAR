// backend/src/routes/tables.routes.js
const express = require("express");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/tables
 * Lista todas las mesas (opcionalmente con su área)
 */
router.get("/", async (req, res) => {
  try {
  const tables = await prisma.table.findMany({
  where: { tenantId: req.tenantId },
  include: { area: true },
  orderBy: { id: "asc" },
});


    res.json(tables);
  } catch (err) {
    console.error("Error al listar mesas:", err);
    res.status(500).json({ error: "Error al listar mesas" });
  }
});

/**
 * POST /api/tables
 * Crea una mesa nueva
 * Body esperado (number ahora es opcional):
 * {
 *   "name": "Mesa 1",
 *   "areaId": 1,
 *   "number": 1 (opcional),
 *   "capacity": 4 (opcional)
 * }
 */
router.post("/", async (req, res) => {
  try {
    let { name, number, areaId, capacity } = req.body;

    // Validar mínimos: nombre y área
    if (!name || !areaId) {
      return res.status(400).json({
        error: "name y areaId son obligatorios",
      });
    }

    // Aseguramos que areaId sea número
    const areaIdNumber = Number(areaId);
    if (!Number.isFinite(areaIdNumber)) {
      return res.status(400).json({
        error: "areaId debe ser numérico",
      });
    }

    // Si no viene number, calculamos el siguiente consecutivo en esa área
    let finalNumber = Number(number);
    if (!Number.isFinite(finalNumber)) {
      const lastTable = await prisma.table.findFirst({
        where: { areaId: areaIdNumber },
        orderBy: { number: "desc" },
      });

      finalNumber = lastTable ? (lastTable.number || 0) + 1 : 1;
    }

 const table = await prisma.table.create({
  data: {
    tenantId: req.tenantId,
    name,
    number: finalNumber,
    areaId: areaIdNumber,
    capacity: capacity ?? 4,
    isActive: true,
  },
});

    res.status(201).json(table);
  } catch (err) {
    console.error("Error al crear mesa:", err);
    res.status(500).json({ error: "Error al crear mesa" });
  }
});

module.exports = router;
