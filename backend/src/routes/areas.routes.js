const express = require("express");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/areas
 * Lista todas las áreas con sus mesas
 */
router.get("/", async (req, res) => {
  try {
    const tenantId = req.tenantId; // ✅ TENANT

    const areas = await prisma.area.findMany({
      where: { tenantId }, // ✅ TENANT
      include: {
        Table: true, // ✅ FIX PRISMA (antes: tables)
      },
      orderBy: { id: "asc" },
    });

    res.json(areas);
  } catch (err) {
    console.error("Error al listar áreas:", err);
    res.status(500).json({ error: "Error al listar áreas" });
  }
});

/**
 * POST /api/areas
 * Crea un área nueva
 */
router.post("/", async (req, res) => {
  try {
    const tenantId = req.tenantId; // ✅ TENANT
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: "El campo 'name' es obligatorio" });
    }

    const area = await prisma.area.create({
      data: {
        name: name.trim(),
        description: description?.trim() || "",
        tenantId, // ✅ TENANT
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
 * Actualiza nombre y/o descripción de un área
 */
router.put("/:id", async (req, res) => {
  try {
    const tenantId = req.tenantId; // ✅ TENANT
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
    if (typeof description !== "undefined") {
      dataToUpdate.description = description;
    }

    const updated = await prisma.area.updateMany({
      where: { id, tenantId }, // ✅ TENANT
      data: dataToUpdate,
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: "Área no encontrada" });
    }

    const area = await prisma.area.findFirst({
      where: { id, tenantId },
      include: {
        Table: true, // ✅ FIX PRISMA (antes: tables)
      },
    });

    res.json(area);
  } catch (err) {
    console.error("Error al actualizar área:", err);
    res.status(500).json({ error: "Error al actualizar área" });
  }
});

/**
 * DELETE /api/areas/:id
 * Elimina un área y sus mesas
 */
router.delete("/:id", async (req, res) => {
  try {
    const tenantId = req.tenantId; // ✅ TENANT
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "ID de área inválido" });
    }

    await prisma.$transaction([
      prisma.table.deleteMany({
        where: {
          areaId: id,
          tenantId, // ✅ TENANT
        },
      }),
      prisma.area.deleteMany({
        where: {
          id,
          tenantId, // ✅ TENANT
        },
      }),
    ]);

    res.json({
      message: "Área y sus mesas eliminadas correctamente",
    });
  } catch (err) {
    console.error("Error al eliminar área:", err);
    res.status(500).json({ error: "Error al eliminar área" });
  }
});

module.exports = router;
