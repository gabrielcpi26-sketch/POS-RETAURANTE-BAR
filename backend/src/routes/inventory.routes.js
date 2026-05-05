// backend/src/routes/inventory.routes.js
const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// ======================
// ✅ TENANT (mínimo, seguro)
// ======================
async function getTenantId(req) {
  // Si ya viene resuelto por middleware (server.js), úsalo
  if (req.tenant && req.tenant.id) return req.tenant.id;

  // Fallback (por header)
  const tenantKey = String(
    req.header("x-tenant") || req.header("x-tenant-key") || "default"
  )
    .trim()
    .toLowerCase();

// FIX mínimo: si viene "laguarida", usar el tenant real existente id 2
if (tenantKey === "laguarida" || tenantKey === "la guarida") {
  const realTenant = await prisma.tenant.findFirst({
    where: { id: 2 },
    select: { id: true },
  });

  if (realTenant) return realTenant.id;
}

const tenant = await prisma.tenant.upsert({
  where: { key: tenantKey },
  update: {},
  create: { key: tenantKey, name: tenantKey },
});

return tenant.id;
}

// Helper: para que tu UI siga mostrando "stock" aunque en DB sea currentStock
function withStockAlias(item) {
  if (!item) return item;
  return { ...item, stock: item.currentStock };
}

// ======================
// GET /api/inventory/low
// ======================
router.get("/low", async (req, res) => {
  try {
    const tenantId = await getTenantId(req);

    const low = await prisma.inventoryItem.findMany({
      where: { tenantId, currentStock: { lte: 2 } },
      orderBy: { currentStock: "asc" },
    });

    return res.json(low.map(withStockAlias));
  } catch (error) {
    console.error("Error al obtener inventario bajo:", error);
    return res.status(500).json({ error: "Error al cargar inventario" });
  }
});

// ======================
// GET /api/inventory/all
// ======================
router.get("/all", async (req, res) => {
  try {
    const tenantId = await getTenantId(req);

    const items = await prisma.inventoryItem.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });

    return res.json(items.map(withStockAlias));
  } catch (error) {
    console.error("Error al obtener inventario:", error);
    return res.status(500).json({ error: "Error al cargar inventario" });
  }
});

// ======================
// POST /api/inventory/create
// ======================
router.post("/create", async (req, res) => {
  try {
    const tenantId = await getTenantId(req);

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Nombre requerido" });
    }

   const item = await prisma.inventoryItem.create({
  data: {
    name,
    currentStock: 0,
    tenantId,
    updatedAt: new Date(), // ✅ FIX CRÍTICO
  }
});

    return res.json(withStockAlias(item));
  } catch (error) {
    console.error("Error al crear producto:", error);
    return res.status(500).json({ error: "Error al crear producto" });
  }
});

// ======================
// POST /api/inventory/movements  ✅ (plural)
// POST /api/inventory/movement   ✅ (alias por compatibilidad)
// ======================
async function handleMovement(req, res) {
  try {
    const tenantId = await getTenantId(req);

    const { itemId, type, quantity, reason } = req.body;
    if (itemId === undefined || !type || quantity === undefined) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const id = Number(itemId);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Producto inválido" });
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: "Cantidad inválida" });
    }

    // ✅ Asegura que el item pertenece al tenant
    const item = await prisma.inventoryItem.findFirst({
      where: { id, tenantId },
      select: { id: true, currentStock: true, tenantId: true },
    });

    if (!item) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    // Normaliza type (tu UI usa Entrada/Salida o IN/OUT según cómo lo tengas)
    const t = String(type).toUpperCase();
    const isOut = t === "OUT" || t === "SALIDA";
    const isIn = t === "IN" || t === "ENTRADA";
    if (!isOut && !isIn) {
      return res.status(400).json({ error: "Tipo inválido" });
    }

    const delta = isOut ? -qty : qty;

    // 1) registra movimiento (asumiendo que tu modelo SÍ tiene tenantId)
    const movement = await prisma.inventoryMovement.create({
      data: {
        itemId: id,
        type: isOut ? "OUT" : "IN",
        quantity: qty,
        reason: reason || "",
        tenantId,
      },
    });

    // 2) ajusta stock SOLO dentro del tenant
    await prisma.inventoryItem.updateMany({
      where: { id, tenantId },
      data: { currentStock: { increment: delta } },
    });

    return res.json({ ok: true, movement });
  } catch (error) {
    console.error("Error al registrar movimiento:", error);
    return res.status(500).json({ error: "Error al registrar movimiento" });
  }
}

router.post("/movements", handleMovement);
router.post("/movement", handleMovement);

// ======================
// POST /api/inventory/export
// ======================
router.post("/export", async (req, res) => {
  try {
    const tenantId = await getTenantId(req);

    const { from, to } = req.body;

    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 86400000);
    const toDate = to ? new Date(to) : new Date();

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        tenantId,
        createdAt: { gte: fromDate, lte: toDate },
      },
      orderBy: { createdAt: "desc" },
    });

    const items = await prisma.inventoryItem.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });

    return res.json({ movements, items: items.map(withStockAlias) });
  } catch (error) {
    console.error("Error al exportar inventario:", error);
    return res.status(500).json({ error: "Error al exportar inventario" });
  }
});

// ======================
// DELETE /api/inventory/:id
// ======================
router.delete("/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId(req);

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const exists = await prisma.inventoryItem.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    await prisma.inventoryMovement.deleteMany({
      where: { itemId: id, tenantId },
    });

    await prisma.inventoryItem.deleteMany({
      where: { id, tenantId },
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    return res.status(500).json({ error: "Error al eliminar producto" });
  }
});

// ======================
// PUT /api/inventory/:id (editar nombre)
// ======================
router.put("/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId(req);

    const id = Number(req.params.id);
    const { name } = req.body;

    if (!Number.isInteger(id) || id <= 0 || !name || !name.trim()) {
      return res.status(400).json({ error: "Datos inválidos" });
    }

    const result = await prisma.inventoryItem.updateMany({
      where: { id, tenantId },
      data: { name: name.trim() },
    });

    if (!result || result.count === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const updated = await prisma.inventoryItem.findFirst({
      where: { id, tenantId },
    });

    return res.json(withStockAlias(updated));
  } catch (error) {
    console.error("Error al editar producto de inventario:", error);
    return res.status(500).json({ error: "Error al actualizar producto" });
  }
});

module.exports = router;
