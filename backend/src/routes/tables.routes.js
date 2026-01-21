// backend/src/routes/tables.routes.js
const express = require("express");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/tables
 */
router.get("/", async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const tablesRaw = await prisma.table.findMany({
      where: { tenantId },
      include: { Area: true },
      orderBy: { id: "asc" },
    });

    // compat: front puede usar table.area
    const tables = tablesRaw.map((t) => {
      const { Area, ...rest } = t;
      return { ...rest, Area, area: Area };
    });

    res.json(tables);
  } catch (err) {
    console.error("Error al listar mesas:", err);
    res.status(500).json({ error: "Error al listar mesas" });
  }
});

/**
 * POST /api/tables
 */
router.post("/", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    let { name, number, areaId, capacity } = req.body;

    if (!name || !areaId) {
      return res.status(400).json({ error: "name y areaId son obligatorios" });
    }

    const areaIdNumber = Number(areaId);
    if (!Number.isFinite(areaIdNumber)) {
      return res.status(400).json({ error: "areaId debe ser numérico" });
    }

    let finalNumber = Number(number);
    if (!Number.isFinite(finalNumber)) {
      const lastTable = await prisma.table.findFirst({
        where: { tenantId, areaId: areaIdNumber },
        orderBy: { number: "desc" },
      });
      finalNumber = lastTable ? (lastTable.number || 0) + 1 : 1;
    }

    const tableRaw = await prisma.table.create({
      data: {
        tenantId,
        name: String(name).trim(),
        number: finalNumber,
        areaId: areaIdNumber,
        capacity: capacity ?? 4,
        isActive: true,
        updatedAt: new Date(), // ✅ si tu schema lo exige
      },
      include: { Area: true },
    });

    const { Area, ...rest } = tableRaw;
    res.status(201).json({ ...rest, Area, area: Area });
  } catch (err) {
    console.error("Error al crear mesa:", err);
    res.status(500).json({ error: "Error al crear mesa" });
  }
});

/**
 * DELETE /api/tables/:id
 * ✅ FIX: borrar mesa aislado por tenant
 */
router.delete("/:id", async (req, res) => {
  try {
    const tenantId = req.tenantId || 1; // ✅ FIX CRÍTICO para DELETE
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "ID de mesa inválido" });
    }

    const deleted = await prisma.table.deleteMany({
      where: { id, tenantId },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: "Mesa no encontrada" });
    }

    return res.json({ message: "Mesa eliminada correctamente" });
  } catch (err) {
    console.error("Error al eliminar mesa:", err);
    res.status(500).json({ error: "Error al eliminar mesa" });
  }
});

module.exports = router;
