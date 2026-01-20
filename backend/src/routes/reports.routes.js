// backend/src/routes/reports.routes.js
const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const db = prisma;


const prisma = new PrismaClient();

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

// Normaliza métodos de pago
function normalizePaymentMethod(pm) {
  const v = String(pm || "CASH").trim().toUpperCase();
  if (v === "CASH" || v === "CARD" || v === "TRANSFER") return v;
  if (v === "EFECTIVO") return "CASH";
  if (v === "TARJETA") return "CARD";
  if (v === "TRANSFERENCIA") return "TRANSFER";
  return "CASH";
}

function safeParseItems(itemsStr) {
  try {
    return itemsStr ? JSON.parse(itemsStr) : [];
  } catch {
    return [];
  }
}

// ===============================
// helper: resolver tenant (mínimo, seguro)
// ===============================
async function resolveTenant(req) {
  const tenantKeyRaw =
    req.header("x-tenant") ||
    req.header("X-Tenant") ||
    req.header("x-tenant-key") ||
    req.header("X-Tenant-Key") ||
    "default";

  const tenantKey = String(tenantKeyRaw).trim().toLowerCase();

  const tenant = await prisma.tenant.upsert({
    where: { key: tenantKey },
    update: {},
    create: { key: tenantKey, name: tenantKey },
  });

  return tenant; // { id, key, name, ... }
}

// ===============================
// POST /api/reports/close-day
// ===============================
router.post("/close-day", async (req, res) => {
  try {
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());

    // ✅ TENANT (sin req.tenant)
    const tenant = await resolveTenant(req);
    const tenantId = tenant.id;

    // Traer órdenes pagadas del día (mantengo tu lógica)
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        isPaid: true,
      },
      select: {
        id: true,
        total: true,
        paymentMethod: true,
      },
    });

    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, o) => sum + (o.total || 0), 0);

    let paymentCash = 0;
    let paymentCard = 0;
    let paymentTransfer = 0;

    for (const o of orders) {
      const m = normalizePaymentMethod(o.paymentMethod);
      const amount = Number(o.total || 0) || 0;

      if (m === "CARD") paymentCard += amount;
      else if (m === "TRANSFER") paymentTransfer += amount;
      else paymentCash += amount;
    }

    // 🕛 Fecha normalizada (MISMO día siempre)
    const reportDate = startOfDay(new Date());

    // ✅ NO usamos tenantId_date (no existe en tu schema)
    // ✅ NO usamos upsert compuesto; hacemos findFirst + update/create (mínimo y estable)
    const existing = await prisma.dailyReport.findFirst({
      where: {
        tenantId: tenantId,
        date: reportDate,
      },
      select: { id: true },
    });

    let dailyReport;

    if (existing) {
      dailyReport = await prisma.dailyReport.update({
        where: { id: existing.id },
        data: {
          totalOrders,
          totalSales,
          paymentCash,
          paymentCard,
          paymentTransfer,
        },
      });
    } else {
      dailyReport = await prisma.dailyReport.create({
        data: {
          tenantId: tenantId,
          date: reportDate,
          totalOrders,
          totalSales,
          paymentCash,
          paymentCard,
          paymentTransfer,
        },
      });
    }

    return res.json({
      ok: true,
      message: "Día cerrado y reporte generado",
      report: dailyReport,
    });
  } catch (error) {
    console.error("❌ Error cierre día:", error);
    return res.status(500).json({ error: "No se pudo cerrar el día" });
  }
});

// ===============================
// GET /api/reports/daily
// ===============================
router.get("/daily", async (req, res) => {
  try {
    const { from, to } = req.query;

    // ✅ TENANT (sin romper)
    const tenant = await resolveTenant(req);
    const tenantId = tenant.id;

    let fromDate;
    let toDate;

    if (from) {
      const [y, m, d] = String(from).split("-").map(Number);
      fromDate = new Date(y, m - 1, d, 0, 0, 0, 0);
    } else {
      const now = new Date();
      fromDate = new Date(now);
      fromDate.setDate(now.getDate() - 6);
      fromDate.setHours(0, 0, 0, 0);
    }

    if (to) {
      const [y, m, d] = String(to).split("-").map(Number);
      toDate = new Date(y, m - 1, d, 23, 59, 59, 999);
    } else {
      const now = new Date();
      toDate = new Date(now);
      toDate.setHours(23, 59, 59, 999);
    }

    const reports = await prisma.dailyReport.findMany({
      where: {
        tenantId: tenantId,
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: { date: "asc" },
    });

    const out = reports.map((r) => ({
      date: new Date(r.date).toISOString().slice(0, 10),
      totalOrders: r.totalOrders || 0,
      totalSales: Number(r.totalSales || 0),
      paymentCash: Number(r.paymentCash || 0),
      paymentCard: Number(r.paymentCard || 0),
      paymentTransfer: Number(r.paymentTransfer || 0),
    }));

// ===============================
// 🔁 FALLBACK: armar histórico desde orders
// ===============================
if (!Array.isArray(reports) || reports.length === 0) {
  const fromQ = from ? new Date(from) : null;
  const toQ = to ? new Date(to) : null;

  const fromD = fromQ
    ? new Date(fromQ.getFullYear(), fromQ.getMonth(), fromQ.getDate(), 0, 0, 0, 0)
    : null;
  const toD = toQ
    ? new Date(toQ.getFullYear(), toQ.getMonth(), toQ.getDate(), 23, 59, 59, 999)
    : null;

  const orders = await db.order.findMany({
    where: {
      tenantId,
      cancelledAt: null,
      ...(fromD && toD ? { paidAt: { gte: fromD, lte: toD } } : {}),
      ...(fromD && !toD ? { paidAt: { gte: fromD } } : {}),
      ...(!fromD && toD ? { paidAt: { lte: toD } } : {}),
    },
    select: {
      paidAt: true,
      total: true,
    },
  });

  const map = new Map();

  for (const o of orders) {
    if (!o.paidAt) continue;

    const d = new Date(o.paidAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const prev = map.get(key) || {
      date: key,
      totalSales: 0,
      totalOrders: 0,
      avgTicket: 0,
    };

    prev.totalSales += Number(o.total || 0);
    prev.totalOrders += 1;
    map.set(key, prev);
  }

  const daily = Array.from(map.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      ...r,
      avgTicket: r.totalOrders > 0 ? r.totalSales / r.totalOrders : 0,
    }));

  return res.json(daily);
}


    return res.json(out);
  } catch (error) {
    console.error("Error al obtener reportes diarios:", error);
    return res
      .status(500)
      .json({ error: "Error al obtener los reportes diarios" });
  }
});

// ===============================
// GET /api/reports/today
// ===============================
router.get("/today", async (req, res) => {
  try {
    // ✅ TENANT (sin romper)
    const tenant = await resolveTenant(req);
    const tenantId = tenant.id;

    const today = startOfDay(new Date());

    // ✅ NO findUnique por date (no es unique en tu schema)
    const report = await prisma.dailyReport.findFirst({
      where: {
        tenantId: tenantId,
        date: today,
      },
    });

    return res.json(report || null);
  } catch (error) {
    console.error("Error al obtener reporte today:", error);
    return res.status(500).json({ error: "Error al obtener reporte today" });
  }
});

module.exports = router;
