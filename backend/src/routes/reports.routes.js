// backend/src/routes/reports.routes.js
const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

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
// POST /api/reports/close-day
// ===============================
router.post("/close-day", async (req, res) => {
  try {
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());

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
      const m = String(o.paymentMethod || "CASH").toUpperCase();
      const amount = Number(o.total || 0) || 0;

      if (m === "CARD") paymentCard += amount;
      else if (m === "TRANSFER") paymentTransfer += amount;
      else paymentCash += amount;
    }

    // ✅ CORRECCIÓN CRÍTICA
    const reportDate = startOfDay(new Date());

    const dailyReport = await prisma.dailyReport.upsert({
      where: { date: reportDate },
      update: {
        totalOrders,
        totalSales,
        paymentCash,
        paymentCard,
        paymentTransfer,
      },
      create: {
        date: reportDate,
        totalOrders,
        totalSales,
        paymentCash,
        paymentCard,
        paymentTransfer,
      },
    });

    return res.json({
      ok: true,
      message: "Día cerrado y reporte generado",
      report: dailyReport, // ✅ variable correcta
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

    return res.json(out);
  } catch (error) {
    console.error("Error al obtener reportes diarios:", error);
    return res.status(500).json({ error: "Error al obtener los reportes diarios" });
  }
});

// GET /api/reports/today
router.get("/today", async (req, res) => {
  const today = new Date();
  today.setHours(0,0,0,0);

  const report = await prisma.dailyReport.findUnique({
    where: { date: today }
  });

  res.json(report || null);
});


module.exports = router;
