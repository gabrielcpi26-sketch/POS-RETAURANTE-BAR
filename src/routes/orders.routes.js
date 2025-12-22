// backend/src/routes/orders.routes.js

const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
console.log("✅ [BOOT] orders.routes.js CARGADO -", __filename, "time:", new Date().toISOString());


// =====================================
// PROMOS: nombre del POS → inventario real
// =====================================
// El nombre debe coincidir con el nombre BASE que mandas desde el POS (item.name)
const PROMO_MAPPINGS = {
  "Cubeta 6 cervezas": { inventoryName: "Cerveza nacional", units: 6 },

  // Ejemplos:
  // "Cubeta 6 cervezas importadas": { inventoryName: "Cerveza importada", units: 6 },
  // "Promo 3 shots tequila": { inventoryName: "Tequila shot", units: 3 },
};

// =============================
// HELPER: Aplicar inventario por items vendidos
// (1:1 + PROMOS + RECETAS)
// =============================
async function applyInventoryFromOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) return;

  // Helpers para leer datos sin romper formatos
  const getQty = (raw) => {
    const qtyRaw = raw.qty ?? raw.quantity ?? raw.cantidad ?? raw.units ?? 1;
    const qty = Number(qtyRaw);
    return Number.isFinite(qty) && qty > 0 ? qty : 0;
  };

  // ✅ CLAVE: nombre BASE para match (NO usa displayName)
  const getBaseName = (raw) =>
    raw.name ||
    raw.productName ||
    raw.title ||
    raw.descripcion ||
    raw.label ||
    raw.nombre ||
    null;

  // displayName solo para mostrar (ticket/UI/log), no para match
  const getDisplayName = (raw) => raw.displayName || getBaseName(raw) || null;

  for (const rawItem of items) {
    try {
      const baseName = getBaseName(rawItem);        // ✅ para promos/recetas/nombre
      const displayName = getDisplayName(rawItem);  // ✅ solo para reason/log
      let qty = getQty(rawItem);
      if (!qty) continue;

      // ✅ PROMOS: usa nombre BASE (no displayName)
      const promo = baseName ? PROMO_MAPPINGS[baseName] : null;
      if (promo) {
        qty = qty * promo.units;
        // si viene inventoryItemId en el item, lo respetamos
        // si no, seguimos con receta/nombre abajo
      }

      // ==================================================
      // ✅ 1) SI VIENE inventoryItemId -> DESCUENTO DIRECTO
      // ==================================================
      const invIdRaw =
        rawItem.inventoryItemId ??
        rawItem.inventory_item_id ??
        rawItem.invItemId ??
        null;

      const invId = invIdRaw ? Number(invIdRaw) : null;

      if (invId && Number.isFinite(invId)) {
        const invItem = await prisma.inventoryItem.findUnique({
          where: { id: invId },
        });
        if (!invItem) continue;

        const stockAntes = invItem.currentStock;
        const newStock =
          invItem.currentStock - qty < 0 ? 0 : invItem.currentStock - qty;

        await prisma.$transaction([
          prisma.inventoryMovement.create({
            data: {
              type: "OUT",
              quantity: qty,
              reason: `Venta automática (ID) "${displayName || baseName || "Producto"}" x${qty}`,
              itemId: invItem.id,
            },
          }),
          prisma.inventoryItem.update({
            where: { id: invItem.id },
            data: { currentStock: newStock },
          }),
        ]);

        console.log("[INVENTARIO][ID] Descuento aplicado:", {
          inventoryItemId: invItem.id,
          nombreBase: baseName,
          displayName,
          qty,
          stockAntes,
          stockDespues: newStock,
        });

        continue;
      }

            // ==================================================
      // ✅ 3) FALLBACK: POR NOMBRE (case-insensitive)
      // ==================================================
      let name = baseName || null;

      // si es promo, usamos el nombre real del inventario
      if (promo) name = promo.inventoryName;

      name = typeof name === "string" ? name.trim() : name;
      if (!name) continue;

      const invItem = await prisma.inventoryItem.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });

      if (!invItem) continue;

      const stockAntes = invItem.currentStock;
      const newStock =
        invItem.currentStock - qty < 0 ? 0 : invItem.currentStock - qty;

      await prisma.$transaction([
        prisma.inventoryMovement.create({
          data: {
            type: "OUT",
            quantity: qty,
            reason: `Venta automática (nombre) "${displayName || name}" → "${name}" x${qty}`,
            itemId: invItem.id,
          },
        }),
        prisma.inventoryItem.update({
          where: { id: invItem.id },
          data: { currentStock: newStock },
        }),
      ]);

      console.log("[INVENTARIO][NOMBRE] Descuento aplicado:", {
        inventoryItemId: invItem.id,
        inventoryName: invItem.name,
        nombreBase: baseName,
        displayName,
        qty,
        stockAntes,
        stockDespues: newStock,
      });
    } catch (err) {
      console.error(
        "[INVENTARIO] Error al aplicar inventario para item de orden:",
        rawItem,
        err
      );
      // La venta sigue aunque inventario falle
    }
  }
}


/* Crear un nuevo pedido */
/* POST /api/orders */

router.post("/", async (req, res) => {
  try {
    const body = req.body || {};

    const tableId = body.tableId;
    const items = body.items;
    const total = body.total;

    // ✅ pagos (evita ReferenceError)
    const paymentMethod = String(body.paymentMethod || "CASH").toUpperCase(); // CASH | CARD | TRANSFER
    const paymentRef = body.paymentRef ? String(body.paymentRef) : null;

    console.log("[ORDERS] POST / - body recibido:", JSON.stringify(body, null, 2));

    if (!tableId || !items || !Array.isArray(items)) {
      return res
        .status(400)
        .json({ error: "Faltan datos del pedido (tableId, items, total)" });
    }

    // 1) Crear pedido
    const created = await prisma.order.create({
      data: {
        tableId: Number(tableId),
        total: Number(total) || 0,
        items: JSON.stringify(items),

        // ✅ guardar pagos (si tu schema ya los tiene)
        paymentMethod,
        paymentRef,
      },
      include: { table: true },
    });

    // 2) Aplicar inventario (ESTO es lo que no se puede perder)
    if (Array.isArray(items) && items.length > 0) {
      try {
        await applyInventoryFromOrderItems(items);
        console.log("[INVENTARIO] OK: aplicado a items del pedido");
      } catch (invErr) {
        console.error("[INVENTARIO] Error al aplicar inventario:", invErr);
        // No tumbamos el pedido; solo avisamos
      }
    }

    return res.json(created);
  } catch (err) {
    console.error("Error al guardar pedido:", err);
    return res.status(500).json({ error: "Error al guardar el pedido" });
  }
});



/**
 * Obtener listado de pedidos
 * GET /api/orders
 */
router.get("/", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        table: true,
      },
    });

    const parsed = orders.map((o) => {
      let items = [];
      try {
        items = o.items ? JSON.parse(o.items) : [];
      } catch {
        items = [];
      }

      return {
        ...o,
        items,
      };
    });

    return res.json(parsed);
  } catch (error) {
    console.error("Error al cargar pedidos:", error);
    return res.status(500).json({ error: "Error al cargar los pedidos" });
  }
});

/**
 * Resumen de ventas (dueño)
 * GET /api/orders/admin/summary
 */
router.get("/admin/summary", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        table: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, order) => sum + (order.total || 0), 0);

    const salesByTableMap = {};
    const productCountMap = {};

    const lastOrders = orders.slice(0, 20).map((o) => {
      let items = [];
      try {
        items = o.items ? JSON.parse(o.items) : [];
      } catch {
        items = [];
      }

      return {
        id: o.id,
        tableName: o.table ? o.table.name : `Mesa ${o.tableId}`,
        total: o.total,
        createdAt: o.createdAt,
        items,
      };
    });

    for (const o of orders) {
      const tableName = o.table ? o.table.name : `Mesa ${o.tableId}`;

      if (!salesByTableMap[tableName]) {
        salesByTableMap[tableName] = {
          tableName,
          orders: 0,
          total: 0,
        };
      }
      salesByTableMap[tableName].orders += 1;
      salesByTableMap[tableName].total += o.total || 0;

      let items = [];
      try {
        items = o.items ? JSON.parse(o.items) : [];
      } catch {
        items = [];
      }

      for (const it of items) {
        const name =
          it.name ||
          it.productName ||
          it.title ||
          it.descripcion ||
          it.label ||
          it.nombre ||
          "Producto";

        const qty =
          Number(it.qty ?? it.quantity ?? it.cantidad ?? it.units ?? 1) || 1;

       const price = Number(it.price ?? it.unitPrice ?? it.precio ?? 0) || 0;

if (!productCountMap[name]) {
  productCountMap[name] = { name, units: 0, sales: 0 };
}

productCountMap[name].units += qty;
productCountMap[name].sales += price * qty;
      }
    }

    const salesByTable = Object.values(salesByTableMap).sort((a, b) => b.total - a.total);
    const topProducts = Object.values(productCountMap).sort((a, b) => b.units - a.units);

    return res.json({
      totalOrders,
      totalSales,
      salesByTable,
      topProducts,
      lastOrders,
    });
  } catch (error) {
    console.error("Error en /admin/summary:", error);
    return res.status(500).json({ error: "Error al obtener el resumen" });
  }
});


// DEBUG inventario
router.get("/debug/inventory-items", async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      select: {
        id: true,
        name: true,
        currentStock: true,
      },
      orderBy: { name: "asc" },
    });

    return res.json(items);
  } catch (err) {
    console.error("[DEBUG INVENTARIO] Error:", err);
    return res.status(500).json({ error: "Error obteniendo inventario debug" });
  }
});

// HISTÓRICO ventas
router.get("/history", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "asc" },
    });

    const grouped = {};
    for (const o of orders) {
      const date = new Date(o.createdAt).toISOString().slice(0, 10);
      if (!grouped[date]) grouped[date] = 0;
      grouped[date] += Number(o.total || 0);
    }

    const result = Object.entries(grouped).map(([date, total]) => ({
      date,
      total,
    }));

    return res.json(result);
  } catch (error) {
    console.error("Error en histórico:", error);
    return res.status(500).json({ error: "Error al obtener histórico" });
  }
});



// ✅ RESUMEN SOLO DEL DÍA ACTUAL (PRISMA)
router.get("/admin/summary-today", async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 1); // mañana 00:00

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lt: end },
      },
      include: { table: true },
      orderBy: { createdAt: "desc" },
    });

    const totalSales = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    // lastOrders con items parseados
    const lastOrders = orders.slice(0, 15).map((o) => {
      let items = [];
      try {
        items = o.items ? JSON.parse(o.items) : [];
      } catch {}
      return {
        id: o.id,
        tableName: o.table ? o.table.name : `Mesa ${o.tableId}`,
        total: o.total,
        createdAt: o.createdAt,
        items,
      };
    });

    // topProducts (rápido)
    const productCountMap = {};
    for (const o of orders) {
      let items = [];
      try {
        items = o.items ? JSON.parse(o.items) : [];
      } catch {}
      for (const it of items) {
        const name =
          it.name ||
          it.productName ||
          it.title ||
          it.descripcion ||
          it.label ||
          it.nombre ||
          "Producto";
        const qty = Number(it.qty ?? it.quantity ?? it.cantidad ?? it.units ?? 1) || 1;
        productCountMap[name] = productCountMap[name] || { name, qty: 0 };
        productCountMap[name].qty += qty;
      }
    }

    const topProducts = Object.values(productCountMap).sort((a, b) => b.qty - a.qty);

    res.json({
      totalSales,
      totalOrders: orders.length,
      lastOrders,
      topProducts,
      salesByTable: [], // si luego lo quieres igual que /admin/summary te lo armo
    });
  } catch (err) {
    console.error("Error en /admin/summary-today:", err);
    res.status(500).json({ error: "Error resumen del día" });
  }
});

// ===============================
// CIERRE DE DÍA → GENERA DAILY REPORT
// ===============================
router.post("/close-day", async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    // 1️⃣ Traer pedidos del día
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });

    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, o) => sum + (o.total || 0), 0);

    // 2️⃣ Guardar / actualizar DailyReport
    const report = await prisma.dailyReport.upsert({
      where: { date: start },
      update: {
        totalOrders,
        totalSales,
      },
      create: {
        date: start,
        totalOrders,
        totalSales,
      },
    });

    res.json({
      ok: true,
      message: "Día cerrado y reporte generado",
      report,
    });
  } catch (error) {
    console.error("❌ Error cierre día:", error);
    res.status(500).json({ error: "No se pudo cerrar el día" });
  }
});

// ✅ CERRAR CUENTA (marca como pagadas todas las órdenes abiertas de esa mesa)
router.put("/close-table/:tableId", async (req, res) => {
  try {
    const tableId = Number(req.params.tableId);
    const { paymentMethod, paymentRef } = req.body;

    if (!Number.isFinite(tableId)) {
      return res.status(400).json({ error: "tableId inválido" });
    }
    if (!paymentMethod) {
      return res.status(400).json({ error: "paymentMethod requerido" });
    }

    // Traer órdenes abiertas (no pagadas) de esa mesa
    const openOrders = await prisma.order.findMany({
      where: { tableId, isPaid: false },
      select: { id: true, total: true },
      orderBy: { id: "asc" },
    });

    if (!openOrders.length) {
      return res.status(200).json({ message: "No hay cuenta pendiente", paidCount: 0, total: 0 });
    }

    const total = openOrders.reduce((s, o) => s + Number(o.total || 0), 0);

    // Marcar todas como pagadas
    await prisma.order.updateMany({
      where: { tableId, isPaid: false },
      data: {
        isPaid: true,
        paidAt: new Date(),
        paymentMethod,
        paymentRef: paymentMethod === "TRANSFER" ? (paymentRef || "") : "",
      },
    });

    return res.json({
      message: "Cuenta cerrada",
      paidCount: openOrders.length,
      total: Number(total.toFixed(2)),
      paymentMethod,
    });
  } catch (err) {
    console.error("Error en close-table:", err);
    return res.status(500).json({ error: "Error al cerrar cuenta" });
  }
});

// =======================
// PEDIDOS ABIERTOS POR MESA
// =======================
router.get("/open/table/:tableId", async (req, res) => {
  try {
    const tableId = Number(req.params.tableId);

    const orders = await prisma.order.findMany({
      where: {
        tableId,
        isPaid: false,
      },
      orderBy: { createdAt: "asc" },
      select: { items: true },
    });

    let allItems = [];
    for (const o of orders) {
      try {
        const parsed = o.items ? JSON.parse(o.items) : [];
        allItems = allItems.concat(parsed);
      } catch {}
    }

    res.json({ items: allItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cargar pedidos de la mesa" });
  }
});



module.exports = router;
