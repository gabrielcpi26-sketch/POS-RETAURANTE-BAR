// backend/src/routes/orders.routes.js

const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
console.log("✅ [BOOT] orders.routes.js CARGADO -", __filename, "time:", new Date().toISOString());

// =====================================
// ✅ TENANT (mínimo, sin romper lógica)
// =====================================
async function resolveTenant(req) {
  const tenantKey = String(
    req.header("x-tenant") || req.header("x-tenant-key") || "default"
  )
    .trim()
    .toLowerCase();

  const key = tenantKey; // ✅ FIX CRÍTICO (esto faltaba)

  const tenant = await prisma.tenant.upsert({
    where: { key },
    update: {},
    create: {
      key,
      name: key,
      updatedAt: new Date(), // ya estaba bien
    },
    select: {
      id: true,
      key: true,
      name: true,
    },
  });

  req.tenant = tenant;
  req.tenantId = tenant.id;
  return tenant;
}

// aplica tenant a TODO este router (mínimo, sin tocar endpoints)
router.use(async (req, res, next) => {
  try {
    await resolveTenant(req);
    next();
  } catch (e) {
    console.error("❌ Error resolviendo tenant:", e);
    return res.status(500).json({ error: "No se pudo resolver tenant" });
  }
});

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
// ✅ db = cliente prisma (normal o tx). Por default usa prisma global.
// ✅ tenantId opcional (si viene -> filtra 100% por tenant)
async function applyInventoryFromOrderItems(items, db = prisma, tenantId = null) {
  if (!Array.isArray(items) || items.length === 0) return;

  const getQty = (raw) => {
    const qtyRaw = raw.qty ?? raw.quantity ?? raw.cantidad ?? raw.units ?? 1;
    const qty = Number(qtyRaw);
    return Number.isFinite(qty) && qty > 0 ? qty : 0;
  };

  const getBaseName = (raw) =>
    raw.name ||
    raw.productName ||
    raw.title ||
    raw.descripcion ||
    raw.label ||
    raw.nombre ||
    null;

  const getDisplayName = (raw) => raw.displayName || getBaseName(raw) || null;

  for (const rawItem of items) {
    try {
      const baseName = getBaseName(rawItem);
      const displayName = getDisplayName(rawItem);

      let qty = getQty(rawItem);
      if (!qty) continue;

      // =============================================
      // ✅ 0) SI VIENE  -> DESCUENTA RECETA (BOM)
      // =============================================
      const recipeIdRaw =
        rawItem.menuRecipeId ??
        rawItem.menuRecipeID ??
        rawItem.menu_recipe_id ??
        rawItem.menu_recipe_ID ??
        null;

      const recipeId = recipeIdRaw ? Number(recipeIdRaw) : null;

      if (recipeId && Number.isFinite(recipeId)) {
        // ✅ TENANT: receta aislada
        const recipe = await db.menuRecipe.findFirst({
          where: tenantId ? { id: recipeId, tenantId } : { id: recipeId },
          select: {
            id: true,
            items: true, // ✅ items = JSON (ingredientes)
          },
        });

        if (!recipe) {
          throw new Error(`Receta ${recipeId} no existe`);
        }

        let recipeItems = [];
        try {
          recipeItems = recipe.items ? JSON.parse(recipe.items) : [];
        } catch {
          recipeItems = [];
        }

        if (!Array.isArray(recipeItems) || recipeItems.length === 0) {
          throw new Error(`Receta ${recipeId} no tiene items`);
        }

        // descuenta cada ingrediente
        for (const ing of recipeItems) {
          const ingId = Number(ing.inventoryItemId ?? ing.itemId ?? 0);
          const ingQty = Number(ing.qty ?? ing.quantity ?? 0);

          if (!Number.isFinite(ingId) || ingId <= 0) continue;
          if (!Number.isFinite(ingQty) || ingQty <= 0) continue;

          const totalIngQty = ingQty * qty;

          // ✅ TENANT: ingrediente aislado
          const invItem = await db.inventoryItem.findFirst({
            where: tenantId ? { id: ingId, tenantId } : { id: ingId },
          });

          if (!invItem) {
            throw new Error(
              `Ingrediente inventoryItemId ${ingId} no existe (receta ${recipeId})`
            );
          }

          const stockAntes = Number(invItem.currentStock || 0);
          const newStock = stockAntes - totalIngQty < 0 ? 0 : stockAntes - totalIngQty;

          // ✅ TENANT: movement aislado
          await db.inventoryMovement.create({
            data: {
              type: "OUT",
              quantity: totalIngQty,
              reason: `Venta receta #${recipeId} "${displayName || baseName || recipe.name}" -> ${invItem.name} x${totalIngQty}`,
              itemId: invItem.id,
              ...(tenantId ? { tenantId } : {}),
            },
          });

          await db.inventoryItem.update({
            where: { id: invItem.id },
            data: { currentStock: newStock },
          });
        }

        // ✅ IMPORTANTE: ya procesamos este item por receta, no seguir a inventoryItemId/nombre
        continue;
      }

      // ✅ PROMOS (por nombre base)
      const promo = baseName ? PROMO_MAPPINGS[baseName] : null;
      if (promo) {
        qty = qty * promo.units;
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
        // ✅ TENANT: item aislado
        const invItem = await db.inventoryItem.findFirst({
          where: tenantId ? { id: invId, tenantId } : { id: invId },
        });

        if (!invItem) {
          // no rompas venta por inventario, mantén tu comportamiento
          throw new Error(`inventoryItemId ${invId} no existe para este tenant`);
        }

        const stockAntes = invItem.currentStock;
        const newStock = invItem.currentStock - qty < 0 ? 0 : invItem.currentStock - qty;

        // ✅ SIN $transaction interno (para poder usarse dentro de tx)
        await db.inventoryMovement.create({
          data: {
            type: "OUT",
            quantity: qty,
            reason: `Venta automática (ID) "${displayName || baseName || "Producto"}" x${qty}`,
            itemId: invItem.id,
            ...(tenantId ? { tenantId } : {}),
          },
        });

        await db.inventoryItem.update({
          where: { id: invItem.id },
          data: { currentStock: newStock },
        });

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
      if (promo) name = promo.inventoryName;

      name = typeof name === "string" ? name.trim() : name;
      if (!name) continue;

      // ✅ TENANT: por nombre aislado
      const invItem = await db.inventoryItem.findFirst({
        where: {
          name: { equals: name, mode: "insensitive" },
          ...(tenantId ? { tenantId } : {}),
        },
      });

      if (!invItem) continue;

      const stockAntes = invItem.currentStock;
      const newStock = invItem.currentStock - qty < 0 ? 0 : invItem.currentStock - qty;

      await db.inventoryMovement.create({
        data: {
          type: "OUT",
          quantity: qty,
          reason: `Venta automática (nombre) "${displayName || name}" → "${name}" x${qty}`,
          itemId: invItem.id,
          ...(tenantId ? { tenantId } : {}),
        },
      });

      await db.inventoryItem.update({
        where: { id: invItem.id },
        data: { currentStock: newStock },
      });

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
      console.error("[INVENTARIO] Error al aplicar inventario para item de orden:", rawItem, err);
      // La venta sigue aunque inventario falle
    }
  }
}

// =============================
// HELPER INVERSO: Revertir inventario por items (DEVOLUCIÓN)
// (ID + PROMOS + NOMBRE) -> IN
// =============================
// ✅ tenantId opcional (si viene -> filtra 100% por tenant)
async function revertInventoryFromOrderItems(items, db = prisma, orderId = null, tenantId = null) {
  if (!Array.isArray(items) || items.length === 0) return;

  const getQty = (raw) => {
    const qtyRaw = raw.qty ?? raw.quantity ?? raw.cantidad ?? raw.units ?? 1;
    const qty = Number(qtyRaw);
    return Number.isFinite(qty) && qty > 0 ? qty : 0;
  };

  const getBaseName = (raw) =>
    raw.name ||
    raw.productName ||
    raw.title ||
    raw.descripcion ||
    raw.label ||
    raw.nombre ||
    null;

  const getDisplayName = (raw) => raw.displayName || getBaseName(raw) || null;

  for (const rawItem of items) {
    try {
      const baseName = getBaseName(rawItem);
      const displayName = getDisplayName(rawItem);

      let qty = getQty(rawItem);
      if (!qty) continue;

      // =============================================
      // ✅ 0) SI VIENE menuRecipeId -> DEVOLVER RECETA (BOM)
      // =============================================
      const recipeIdRaw =
        rawItem.menuRecipeId ??
        rawItem.menuRecipeID ??
        rawItem.menu_recipe_id ??
        rawItem.menu_recipe_ID ??
        null;

      const recipeId = recipeIdRaw ? Number(recipeIdRaw) : null;

      if (recipeId && Number.isFinite(recipeId)) {
        const recipe = await db.menuRecipe.findFirst({
          where: tenantId ? { id: recipeId, tenantId } : { id: recipeId },
          select: {
            id: true,
            items: true, // ✅ items = JSON (ingredientes)
          },
        });

        if (!recipe) {
          throw new Error(`Rollback: receta ${recipeId} no existe (orden #${orderId ?? "?"})`);
        }

        let recipeItems = [];
        try {
          recipeItems = recipe.items ? JSON.parse(recipe.items) : [];
        } catch {
          recipeItems = [];
        }

        if (!Array.isArray(recipeItems) || recipeItems.length === 0) {
          throw new Error(`Rollback: receta ${recipeId} sin items (orden #${orderId ?? "?"})`);
        }

        for (const ing of recipeItems) {
          const ingId = Number(ing.inventoryItemId ?? ing.itemId ?? 0);
          const ingQty = Number(ing.qty ?? ing.quantity ?? 0);

          if (!Number.isFinite(ingId) || ingId <= 0) continue;
          if (!Number.isFinite(ingQty) || ingQty <= 0) continue;

          const totalIngQty = ingQty * qty;

          const invItem = await db.inventoryItem.findFirst({
            where: tenantId ? { id: ingId, tenantId } : { id: ingId },
          });

          if (!invItem) {
            throw new Error(`Rollback: ingrediente ${ingId} no existe (receta ${recipeId})`);
          }

          const stockAntes = Number(invItem.currentStock || 0);
          const newStock = stockAntes + totalIngQty;

          await db.inventoryMovement.create({
            data: {
              type: "IN",
              quantity: totalIngQty,
              reason: `Devolución orden #${orderId ?? "?"} receta #${recipeId} "${displayName || baseName || recipe.name}" -> ${invItem.name} +${totalIngQty}`,
              itemId: invItem.id,
              ...(tenantId ? { tenantId } : {}),
            },
          });

          await db.inventoryItem.update({
            where: { id: invItem.id },
            data: { currentStock: newStock },
          });
        }

        continue; // ✅ ya se procesó por receta
      }

      // ✅ PROMOS (por nombre base)
      const promo = baseName ? PROMO_MAPPINGS[baseName] : null;
      if (promo) qty = qty * promo.units;

      // ==================================================
      // ✅ 1) SI VIENE inventoryItemId -> REVERSO DIRECTO
      // ==================================================
      const invIdRaw =
        rawItem.inventoryItemId ??
        rawItem.inventory_item_id ??
        rawItem.invItemId ??
        null;

      const invId = invIdRaw ? Number(invIdRaw) : null;

      if (invId && Number.isFinite(invId)) {
        const invItem = await db.inventoryItem.findFirst({
          where: tenantId ? { id: invId, tenantId } : { id: invId },
        });

        if (!invItem) continue;

        const stockAntes = Number(invItem.currentStock ?? 0);
        const newStock = stockAntes + Number(qty || 0);

        await db.inventoryMovement.create({
          data: {
            type: "IN",
            quantity: qty,
            reason: `Devolución orden #${orderId ?? "?"} (ID) "${displayName || baseName || "Producto"}" +${qty}`,
            itemId: invItem.id,
            ...(tenantId ? { tenantId } : {}),
          },
        });

        await db.inventoryItem.update({
          where: { id: invItem.id },
          data: { currentStock: newStock },
        });

        console.log("[INVENTARIO][ROLLBACK][ID] Reverso aplicado:", {
          orderId,
          inventoryItemId: invItem.id,
          baseName,
          displayName,
          qty,
          stockAntes,
          stockDespues: newStock,
        });

        continue;
      }

      // ==================================================
      // ✅ 2) FALLBACK: POR NOMBRE (case-insensitive)
      // ==================================================
      let name = baseName || null;
      if (promo) name = promo.inventoryName;

      name = typeof name === "string" ? name.trim() : name;
      if (!name) continue;

      const invItem = await db.inventoryItem.findFirst({
        where: {
          name: { equals: name, mode: "insensitive" },
          ...(tenantId ? { tenantId } : {}),
        },
      });
      if (!invItem) continue;

      const stockAntes = invItem.currentStock;
      const newStock = invItem.currentStock + qty;

      await db.inventoryMovement.create({
        data: {
          type: "IN",
          quantity: qty,
          reason: `Devolución orden #${orderId ?? "?"} (nombre) "${displayName || name}" → "${name}" +${qty}`,
          itemId: invItem.id,
          ...(tenantId ? { tenantId } : {}),
        },
      });

      await db.inventoryItem.update({
        where: { id: invItem.id },
        data: { currentStock: newStock },
      });

      console.log("[INVENTARIO][ROLLBACK][NOMBRE] Reverso aplicado:", {
        orderId,
        inventoryItemId: invItem.id,
        inventoryName: invItem.name,
        baseName,
        displayName,
        qty,
        stockAntes,
        stockDespues: newStock,
      });
    } catch (err) {
      console.error("[INVENTARIO][ROLLBACK] Error revertiendo inventario:", rawItem, err);
      throw err; // ✅ IMPORTANTÍSIMO: si falla rollback, falla cancelación
    }
  }
}

/* Crear/actualizar pedido (MISMA FILA por mesa) */
/* POST /api/orders */
router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const tenantId = req.tenantId;

    const tableId = Number(body.tableId);
    const items = body.items;
    const total = Number(body.total) || 0;

    // ✅ pagos (evita ReferenceError)
    const paymentMethod = String(body.paymentMethod || "CASH").toUpperCase();
    const paymentRef = body.paymentRef ? String(body.paymentRef) : null;

    console.log("[ORDERS] POST / - body recibido:", JSON.stringify(body, null, 2));

    if (!Number.isFinite(tableId) || !items || !Array.isArray(items)) {
      return res
        .status(400)
        .json({ error: "Faltan datos del pedido (tableId, items, total)" });
    }

    // ✅ 1) Buscar pedido abierto existente para esa mesa (MISMA FILA)
    const existingOpen = await prisma.order.findFirst({
      where: { tableId, isPaid: false, tenantId },
      orderBy: { createdAt: "desc" }, // por si hubiera más de uno, toma el más reciente
      select: { id: true },
    });

    // ✅ 2) Update si existe, Create si no existe
    const saved = existingOpen
      ? await prisma.order.update({
          where: { id: existingOpen.id },
          data: {
            total,
            items: JSON.stringify(items),

            // si tu schema tiene estos campos, se actualizan
            paymentMethod,
            paymentRef,
          },
          include: { Table: true }, // ✅ FIX: Prisma relation real
        })
      : await prisma.order.create({
          data: {
            tenantId,
            tableId,
            total,
            items: JSON.stringify(items),

            paymentMethod,
            paymentRef,
          },
          include: { Table: true }, // ✅ FIX: Prisma relation real
        });

    // ✅ REGLA #1: aquí NO se descuenta inventario.
    return res.json(saved);
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
    const tenantId = req.tenantId;

    const orders = await prisma.order.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        Table: true,  // ✅ FIX
        Tenant: true, // ✅ FIX (si existe en tu schema)
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
    const tenantId = req.tenantId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
        isPaid: true, // ✅ SOLO pagadas
      },
      include: {
        Table: true, // ✅ FIX
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const isCancelled = (o) => Boolean(o?.isCancelled) || Boolean(o?.cancelledAt);
    const ordersValid = orders.filter((o) => !isCancelled(o));

    const totalOrders = ordersValid.length;
    const totalSales = ordersValid.reduce((sum, order) => sum + (order.total || 0), 0);

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
        tableName: o.Table ? o.Table.name : `Mesa ${o.tableId}`, // ✅ FIX
        total: o.total,
        createdAt: o.createdAt,
        items,
      };
    });

    for (const o of ordersValid) {
      const tableName = o.Table ? o.Table.name : `Mesa ${o.tableId}`; // ✅ FIX

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

        const qty = Number(it.qty ?? it.quantity ?? it.cantidad ?? it.units ?? 1) || 1;
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
    // 🔥 BACKWARD COMPATIBLE
    // Si NO hay tenant, devolvemos TODO como antes
    const tenantId =
      req.tenantId ??
      req.headers["x-tenant-id"] ??
      req.query.tenantId ??
      null;

    const whereClause =
      tenantId && Number(tenantId) > 0
        ? { tenantId: Number(tenantId) }
        : {}; // 👈 CLAVE: sin tenant = no filtro

    const items = await prisma.inventoryItem.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        currentStock: true,
      },
      orderBy: { name: "asc" },
    });

    const normalized = items.map((i) => ({
      ...i,
      stock: i.currentStock,
    }));

    return res.json(normalized);
  } catch (err) {
    console.error("[DEBUG INVENTORY ITEMS]", err);
    return res.status(500).json({ error: "Inventory debug error" });
  }
});

// HISTÓRICO ventas
router.get("/history", async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const orders = await prisma.order.findMany({
      where: { tenantId },
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

// ✅ RESUMEN SOLO DEL DÍA ACTUAL (PRISMA) — PRO: neto + canceladas
router.get("/admin/summary-today", async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 1); // mañana 00:00

    // Trae pedidos del día
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: start, lt: end },
        isPaid: true, // ✅ SOLO pagadas para corte/resumen
      },
      include: { Table: true }, // ✅ FIX
      orderBy: { createdAt: "desc" },
    });

    // 🔥 PRO: separar canceladas vs válidas
    const isCancelled = (o) => Boolean(o?.isCancelled) || Boolean(o?.cancelledAt);

    const cancelledOrders = orders.filter(isCancelled);
    const validOrders = orders.filter((o) => !isCancelled(o));

    const grossSales = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const cancelledSales = cancelledOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    const netSales = Math.max(0, grossSales - cancelledSales);

    // lastOrders con items parseados + flags
    const lastOrders = orders.slice(0, 15).map((o) => {
      let items = [];
      try {
        items = o.items ? JSON.parse(o.items) : [];
      } catch {}
      return {
        id: o.id,
        tableName: o.Table ? o.Table.name : `Mesa ${o.tableId}`, // ✅ FIX
        total: o.total,
        createdAt: o.createdAt,
        items,

        // 👇 IMPORTANTÍSIMO para el front (persistencia “Cancelada”)
        isPaid: Boolean(o.isPaid),
        isCancelled: isCancelled(o),
        cancelledAt: o.cancelledAt || null,
      };
    });

    // topProducts SOLO de ventas válidas (para que no infle por cancelaciones)
    const productCountMap = {};
    for (const o of validOrders) {
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

    // ✅ Compatibilidad: mantenemos totalSales/totalOrders como NETO (lo que cuadra con corte)
    res.json({
      totalSales: netSales,
      totalOrders: validOrders.length,

      // ✅ Auditoría PRO
      grossSales,
      cancelledSales,
      cancelledOrders: cancelledOrders.length,
      netSales,

      lastOrders,
      topProducts,
      salesByTable: [],
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
    const tenantId = req.tenantId;

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    // 1️⃣ Traer pedidos del día
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: start, lte: end },
        isPaid: true,
      },
    });

    const isCancelled = (o) => Boolean(o?.isCancelled) || Boolean(o?.cancelledAt);

    const grossSales = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const cancelledSales = orders
      .filter(isCancelled)
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const totalOrders = orders.filter((o) => !isCancelled(o)).length;
    const totalSales = Math.max(0, grossSales - cancelledSales);

    // 2️⃣ Guardar / actualizar DailyReport (AISLADO por tenant)
    const report = await prisma.dailyReport.upsert({
      where: {
        tenantId_date: {
          tenantId,
          date: start,
        },
      },
      update: {
        totalOrders,
        totalSales, // netas como hoy
        grossSales,
        cancelledSales,
        netSales: totalSales, // netas oficiales del día
      },
      create: {
        tenantId,
        date: start,
        totalOrders,
        totalSales, // netas
        grossSales,
        cancelledSales,
        netSales: totalSales,
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

// =======================
// PRINT STREAM (SSE) por tenant
// =======================
const printClientsByTenant = new Map(); // tenantId -> Set(res)

function broadcastPrintJob(tenantId, payload) {
  const clients = printClientsByTenant.get(tenantId);
  if (!clients || clients.size === 0) return;
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try { res.write(msg); } catch {}
  }
}

router.get("/print/stream", (req, res) => {
  const tenantId = req.tenantId;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  if (!printClientsByTenant.has(tenantId)) printClientsByTenant.set(tenantId, new Set());
  printClientsByTenant.get(tenantId).add(res);

  // ping para que no muera
  const keep = setInterval(() => {
    try { res.write(":ping\n\n"); } catch {}
  }, 25000);

  req.on("close", () => {
    clearInterval(keep);
    try { printClientsByTenant.get(tenantId)?.delete(res); } catch {}
  });
});


// ✅ CERRAR CUENTA (marca como pagadas todas las órdenes abiertas de esa mesa)
// ✅ AQUI se descuenta inventario REAL (Regla #2)
router.put("/close-table/:tableId", async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const tableId = Number(req.params.tableId);
    const { paymentMethod, paymentRef } = req.body;

    if (!Number.isFinite(tableId)) {
      return res.status(400).json({ error: "tableId inválido" });
    }
    if (!paymentMethod) {
      return res.status(400).json({ error: "paymentMethod requerido" });
    }

    const paidAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1) Traer órdenes abiertas (incluye items)
      const openOrders = await tx.order.findMany({
        where: { tenantId, tableId, isPaid: false },
        select: { id: true, total: true, items: true },
        orderBy: { id: "asc" },
      });

      if (!openOrders.length) {
        return { alreadyClosed: true, paidCount: 0, total: 0 };
      }

      const total = openOrders.reduce((s, o) => s + Number(o.total || 0), 0);

      // 2) Unir items de TODAS las órdenes abiertas
      let allItems = [];
      for (const o of openOrders) {
        try {
          const parsed = o.items ? JSON.parse(o.items) : [];
          if (Array.isArray(parsed)) allItems = allItems.concat(parsed);
        } catch {}
      }

      // 3) Marcar como pagadas (idempotencia por updateMany)
      const upd = await tx.order.updateMany({
        where: { tenantId, tableId, isPaid: false },
        data: {
          isPaid: true,
          paidAt,
          paymentMethod,
          paymentRef: String(paymentMethod).toUpperCase() === "TRANSFER" ? (paymentRef || "") : "",
        },
      });



      // Si por alguna razón otro proceso ya las cerró antes de llegar aquí, no descontamos.
     
if (upd.count === 0) {
        return { alreadyClosed: true, paidCount: 0, total: 0 };
      }

// ✅ CAMBIO MINIMO: si viene desde MESERO, encolar impresión SIN romper cierre
const fromDevice = String(req.headers["x-device"] || "").toLowerCase();

if (fromDevice === "mesero") {
  const payload = {
    table: { id: tableId, name: `Mesa ${tableId}` }, // ✅ sin DB
    items: allItems,
    paymentMethod,
    paymentRef,
    total: Number(total.toFixed(2)),
  };

  try {
    // ⚠️ Si no existe printJob en Prisma/DB, NO debe tumbar el cierre
    if (tx.printJob && typeof tx.printJob.create === "function") {
      await tx.printJob.create({
        data: {
          tenantId,
          type: "close_ticket",
          payload: JSON.stringify(payload),
          status: "pending",
        },
      });
} else {
  console.warn("⚠️ printJob no está disponible en Prisma (se omite cola).");
}


  } catch (e) {
    console.warn("⚠️ No se pudo crear printJob (se omite cola):", e?.message || e);
  }
}


      // 4) ✅ DESCONTAR INVENTARIO REAL (solo aquí)
      if (allItems.length > 0) {
        await applyInventoryFromOrderItems(allItems, tx, tenantId);
        console.log("📦 Inventario descontado al cerrar cuenta (OK)");
      }

      // ✅ CAMBIO MINIMO: regresamos items para que la compu imprima lo mismo
      return { alreadyClosed: false, paidCount: openOrders.length, total, items: allItems };
    });

    if (result.alreadyClosed) {
      return res.status(200).json({ message: "No hay cuenta pendiente", paidCount: 0, total: 0 });
    }

 

    return res.json({
      message: "Cuenta cerrada",
      paidCount: result.paidCount,
      total: Number(result.total.toFixed(2)),
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
    const tenantId = req.tenantId;

    const tableId = Number(req.params.tableId);

    const orders = await prisma.order.findMany({
      where: {
        tenantId,
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

// ======================================
// CANCELAR / DEVOLVER VENTA (ROLLBACK)
// ======================================
router.put("/cancel/:orderId", async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const orderId = Number(req.params.orderId);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: "orderId inválido" });
    }

    // ✅ FIX: guardar total fuera (order NO existe afuera del tx)
    let cancelledTotal = 0;

    await prisma.$transaction(async (tx) => {
      // 1️⃣ Traer la orden (AISLADA POR TENANT)
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId },
        select: {
          id: true,
          isPaid: true,
          items: true,
          total: true,
          isCancelled: true,
          cancelledAt: true,
        },
      });

      if (!order) throw new Error("Orden no encontrada");

      // ✅ Guardar total para responder
      cancelledTotal = Number(order.total || 0);

      // 2️⃣ Validaciones duras
      if (!order.isPaid) throw new Error("La orden no está pagada");

      if (order.isCancelled || order.cancelledAt) {
        throw new Error("La orden ya fue cancelada anteriormente");
      }

      // 3️⃣ Idempotencia extra: ¿ya existe movimiento IN de devolución? (AISLADO POR TENANT)
      const alreadyCanceled = await tx.inventoryMovement.findFirst({
        where: {
          ...(tenantId ? { tenantId } : {}),
          type: "IN",
          reason: { contains: `Devolución orden #${orderId}` },
        },
        select: { id: true },
      });

      if (alreadyCanceled) throw new Error("La orden ya fue cancelada anteriormente");

      // 4️⃣ Parsear items
      let items = [];
      try {
        items = order.items ? JSON.parse(order.items) : [];
      } catch {
        items = [];
      }

      if (!items.length) throw new Error("La orden no tiene items para revertir");

      // 5️⃣ ✅ Rollback inventario (SI FALLA → debe fallar la cancelación)
      await revertInventoryFromOrderItems(items, tx, orderId, tenantId);

      // 6️⃣ Marcar cancelación permanente (misma transacción)
      await tx.order.update({
        where: { id: orderId },
        data: { isCancelled: true, cancelledAt: new Date() },
      });
    });

    return res.json({
      ok: true,
      message: "Venta cancelada y stock restaurado correctamente",
      orderId,
      cancelledTotal,
    });
  } catch (err) {
    console.error("❌ Error cancelando venta:", err.message || err);
    return res.status(400).json({
      error: err.message || "No se pudo cancelar la venta",
    });
  }
});

// ✅ Traer tickets pendientes para imprimir (solo compu)
router.get("/print-jobs", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const type = String(req.query.type || "");
    const status = String(req.query.status || "pending");

    const jobs = await prisma.printJob.findMany({
      where: { tenantId, type, status },
      orderBy: { id: "asc" },
      take: 20,
    });

    res.json(jobs.map(j => ({
      id: j.id,
      type: j.type,
      payload: j.payload,
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "print-jobs error" });
  }
});

// ✅ Marcar como impreso
router.post("/print-jobs/:id/printed", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const id = Number(req.params.id);

    await prisma.printJob.updateMany({
      where: { id, tenantId },
      data: { status: "printed", printedAt: new Date() },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "mark printed error" });
  }
});


module.exports = router;
