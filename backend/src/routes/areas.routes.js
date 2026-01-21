// backend/src/routes/areas.routes.js
const express = require("express");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/areas
 * Lista todas las áreas con sus mesas
 * (Mantiene compatibilidad: responde "tables" para el front)
 */
router.get("/", async (req, res) => {
  try {
    const tenantId = req.tenantId; // ✅ TENANT

    const areasRaw = await prisma.area.findMany({
      where: { tenantId },
      include: { Table: true }, // relación real
      orderBy: { id: "asc" },
    });

    const areas = areasRaw.map((a) => {
      const { Table, ...rest } = a;
      return { ...rest, tables: Table };
    });

    res.json(areas);
  } catch (err) {
    console.error("Error al listar áreas:", err);
    res.status(500).json({ error: "Error al listar áreas" });
  }
});

/**
 * POST /api/areas
 */
router.post("/", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: "El campo 'name' es obligatorio" });
    }

    const area = await prisma.area.create({
      data: {
        name: name.trim(),
        description: description?.trim() || "",
        tenantId,
        updatedAt: new Date(), // ✅ por si tu schema lo exige
      },
    });

    res.status(201).json(area);
  } catch (err) {
    console.error("Error al crear área:", err);
    res.status(500).json({ error: "Error al crear área" });
  }
});

/**
 * PUT /api/areas/:id
 */
router.put("/:id", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const id = Number(req.params.id);
    const { name, description } = req.body;

    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "ID de área inválido" });
    }

    if (!name && typeof description === "undefined") {
      return res.status(400).json({
        error: "Debes enviar al menos 'name' o 'description' para actualizar",
      });
    }

    const dataToUpdate = {};
    if (name) dataToUpdate.name = name;
    if (typeof description !== "undefined") dataToUpdate.description = description;
    dataToUpdate.updatedAt = new Date(); // ✅

    const updated = await prisma.area.updateMany({
      where: { id, tenantId },
      data: dataToUpdate,
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: "Área no encontrada" });
    }

    const areaRaw = await prisma.area.findFirst({
      where: { id, tenantId },
      include: { Table: true },
    });

    if (!areaRaw) return res.status(404).json({ error: "Área no encontrada" });

    const { Table, ...rest } = areaRaw;
    const area = { ...rest, tables: Table };

    res.json(area);
  } catch (err) {
    console.error("Error al actualizar área:", err);
    res.status(500).json({ error: "Error al actualizar área" });
  }
});

/**
 * DELETE /api/areas/:id
 * ❌ No permite borrar si existen pedidos asociados
 */
router.delete("/:id", async (req, res) => {
  try {
    const tenantId = req.tenantId || 1; // local safe
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "ID de área inválido" });
    }

    // 1️⃣ Traer mesas del área
    const tables = await prisma.table.findMany({
      where: { areaId: id, tenantId },
      select: { id: true },
    });

    const tableIds = tables.map((t) => t.id);

    // 2️⃣ Verificar si hay pedidos ligados a esas mesas
    if (tableIds.length > 0) {
      const ordersCount = await prisma.order.count({
        where: {
          tenantId,
          tableId: { in: tableIds },
        },
      });

      if (ordersCount > 0) {
        return res.status(400).json({
          error: "No se puede eliminar el área porque tiene pedidos asociados",
        });
      }
    }

    // 3️⃣ Si NO hay pedidos → borrar mesas y área
    await prisma.$transaction([
      prisma.table.deleteMany({
        where: { areaId: id, tenantId },
      }),
      prisma.area.deleteMany({
        where: { id, tenantId },
      }),
    ]);

    return res.json({
      message: "Área y sus mesas eliminadas correctamente",
    });
  } catch (err) {
    console.error("Error al eliminar área:", err);
    res.status(500).json({ error: "Error al eliminar área" });
  }
});


module.exports = router;
