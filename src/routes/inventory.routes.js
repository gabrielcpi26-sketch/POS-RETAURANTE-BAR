// backend/src/routes/inventory.routes.js
const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const SEED_ITEMS = [
  { name: "Cerveza nacional", sku: "CERV_NAC", unit: "pz" },
  { name: "Cerveza importada", sku: "CERV_IMP", unit: "pz" },
  { name: "Cubeta 6 cervezas", sku: "CUBETA_6", unit: "cubeta" },
  { name: "Tequila shot", sku: "TEQ_SHOT", unit: "shot" },
  { name: "Whisky trago", sku: "WHISKY_TR", unit: "trago" },
  { name: "Vodka trago", sku: "VODKA_TR", unit: "trago" },
  { name: "Refresco 355 ml", sku: "REF_355", unit: "pz" },
  { name: "Agua natural", sku: "AGUA_NAT", unit: "pz" },
  { name: "Botana mixta", sku: "BOT_MIX", unit: "orden" },
];

// GET /api/inventory/summary
router.get("/summary", async (req, res) => {
  try {
    let items = await prisma.inventoryItem.findMany({
      orderBy: { name: "asc" },
    });

    // ❌ DESACTIVADO: seed automático de inventario
// if (items.length === 0) {
//   await prisma.inventoryItem.createMany({ data: SEED_ITEMS });
//   items = await prisma.inventoryItem.findMany({
//     orderBy: { name: "asc" },
//   });
// }

    return res.json({ items });
  } catch (error) {
    console.error("Error al obtener inventario:", error);
    return res.status(500).json({ error: "Error al obtener el inventario" });
  }
});

// POST /api/inventory/items
// Crear un producto de inventario (alta rápida desde UI)
router.post("/items", async (req, res) => {
  try {
    const { name, unit, sku } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "name es obligatorio" });
    }

    const created = await prisma.inventoryItem.create({
      data: {
        name: String(name).trim(),
        unit: unit ? String(unit).trim() : "pz",
        sku: sku ? String(sku).trim() : null,
        currentStock: 0,
      },
    });

    return res.status(201).json(created);
  } catch (error) {
    console.error("Error al crear producto de inventario:", error);
    return res.status(500).json({ error: "Error al crear producto" });
  }
});



// POST /api/inventory/movements
router.post("/movements", async (req, res) => {
  try {
    const { itemId, type, quantity, reason } = req.body;

    if (!itemId || !type || !quantity) {
      return res
        .status(400)
        .json({ error: "itemId, type y quantity son obligatorios" });
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res
        .status(400)
        .json({ error: "La cantidad debe ser un número positivo" });
    }

    if (type !== "IN" && type !== "OUT") {
      return res.status(400).json({ error: 'type debe ser "IN" o "OUT"' });
    }

    const item = await prisma.inventoryItem.findUnique({
      where: { id: Number(itemId) },
    });

    if (!item) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    let newStock =
      type === "IN" ? item.currentStock + qty : item.currentStock - qty;
    if (newStock < 0) newStock = 0;

    const movementData = {
      itemId: item.id,
      type,
      quantity: qty,
      reason: reason || null,
    };

    const [movement, updatedItem] = await prisma.$transaction([
      prisma.inventoryMovement.create({ data: movementData }),
      prisma.inventoryItem.update({
        where: { id: item.id },
        data: { currentStock: newStock },
      }),
    ]);

    return res.json({
      message: "Movimiento registrado correctamente",
      movement,
      item: updatedItem,
    });
  } catch (error) {
    console.error("Error al registrar movimiento:", error);
    return res
      .status(500)
      .json({ error: "Error al registrar el movimiento" });
  }
});

// GET /api/inventory/report
router.get("/report", async (req, res) => {
  try {
    const { from, to } = req.query;

    const now = new Date();
    let fromDate;
    let toDate;

    if (from && to) {
      fromDate = new Date(from);
      toDate = new Date(to);
    } else {
      toDate = now;
      fromDate = new Date(now);
      fromDate.setDate(now.getDate() - 30);
    }

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: { item: true },
      orderBy: { createdAt: "asc" },
    });

    const map = new Map();

    movements.forEach((m) => {
      const key = m.itemId;
      if (!map.has(key)) {
        map.set(key, {
          itemId: m.itemId,
          itemName: m.item.name,
          sku: m.item.sku,
          unit: m.item.unit,
          entries: 0,
          outputs: 0,
        });
      }
      const row = map.get(key);
      if (m.type === "IN") row.entries += m.quantity;
      if (m.type === "OUT") row.outputs += m.quantity;
    });

    const rows = [];
    for (const row of map.values()) {
      const item = await prisma.inventoryItem.findUnique({
        where: { id: row.itemId },
      });
      rows.push({
        ...row,
        netQuantity: row.entries - row.outputs,
        finalStock: item ? item.currentStock : 0,
      });
    }

    return res.json({ from: fromDate, to: toDate, rows });
  } catch (error) {
    console.error("Error al generar reporte de inventario:", error);
    return res
      .status(500)
      .json({ error: "Error al generar el reporte de inventario" });
  }
});

// PUT /api/inventory/:id
// Permite editar el nombre de un producto de inventario
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name } = req.body;

    if (!id || !name || !name.trim()) {
      return res.status(400).json({ error: "Datos inválidos" });
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: { name: name.trim() },
    });

    return res.json(updated);
  } catch (error) {
    console.error("Error al editar producto de inventario:", error);
    return res
      .status(500)
      .json({ error: "Error al actualizar producto" });
  }
});


module.exports = router;
