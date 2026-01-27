const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Cola fallback (por si no existe tabla o falla SQL)
const PRINT_QUEUE = [];

// ===========================
// POST /api/print-jobs/close-ticket
// Body: { ticketText: "...." }
// ===========================
router.post("/close-ticket", async (req, res) => {
  try {
    const tenantKey = (
      req.tenantKey ||
      req.headers["x-tenant-key"] ||
      req.headers["x-tenant"] ||
      req.headers["x-tenant-id"] ||
      "default"
    )
      .toString()
      .trim()
      .toLowerCase();

    const { ticketText } = req.body || {};

    // ✅ FIX: YA NO pedimos orderId
    if (!ticketText) {
      return res.status(400).json({ error: "ticketText required" });
    }

    // ======================================================
    // ✅ ANTI-DUPLICADO (SOLO PARA MODO MESERO)
    // mismo tenant + mismo ticketText en ventana corta
    // ======================================================
    try {
      const dup = await prisma.$queryRaw`
        SELECT id
        FROM print_jobs
        WHERE tenant_key = ${tenantKey}
          AND ticket_text = ${String(ticketText)}
          AND created_at >= NOW() - INTERVAL '10 seconds'
        ORDER BY id DESC
        LIMIT 1
      `;

      if (Array.isArray(dup) && dup.length > 0) {
        // ⚠️ Ya existe uno reciente → no reinsertar
        return res.json({ ok: true, dedup: true });
      }
    } catch (e) {
      // si falla dedup, NO rompemos flujo
      console.warn("⚠️ dedup check failed:", e?.message || e);
    }

    // ======================================================
    // 1) Intento DB real: tabla print_jobs
    // ======================================================
    try {
      await prisma.$executeRaw`
        INSERT INTO print_jobs (tenant_key, type, ticket_text, status)
        VALUES (${tenantKey}, ${"close-ticket"}, ${String(ticketText)}, ${"pending"})
      `;
    } catch (dbErr) {
      console.warn(
        "⚠️ print_jobs DB insert failed, usando cola en memoria:",
        dbErr?.message || dbErr
      );

      // ======================================================
      // 2) Fallback cola memoria (para no romper flujo)
      // ======================================================
      PRINT_QUEUE.push({
        id: Date.now(),
        tenantKey,
        type: "close-ticket",
        ticketText: String(ticketText),
        status: "pending",
        createdAt: new Date().toISOString(),
      });
    }

    // ✅ SIEMPRE OK (no mostrar error al mesero)
    return res.json({ ok: true });
  } catch (e) {
    console.error("❌ close-ticket error:", e);
    // ✅ no romper mesero
    return res.json({ ok: true });
  }
});

// ===========================
// GET /api/print-jobs/next
// Devuelve siguiente pending del tenant
// ===========================
router.get("/next", async (req, res) => {
  try {
    const tenantKey = (
      req.tenantKey ||
      req.headers["x-tenant-key"] ||
      req.headers["x-tenant"] ||
      req.headers["x-tenant-id"] ||
      "default"
    )
      .toString()
      .trim()
      .toLowerCase();

    // ======================================================
    // 1) Intento DB real (print_jobs)
    // ======================================================
    try {
      const rows = await prisma.$queryRaw`
        SELECT id, ticket_text
        FROM print_jobs
        WHERE tenant_key = ${tenantKey}
          AND status = ${"pending"}
        ORDER BY id ASC
        LIMIT 1
      `;

      const job = Array.isArray(rows) && rows.length ? rows[0] : null;

      if (job?.id) {
        // marcar como "printed" DE INMEDIATO para no duplicar
        await prisma.$executeRaw`
          UPDATE print_jobs
          SET status = ${"printed"}
          WHERE id = ${job.id}
        `;

        return res.json({
          job: {
            id: job.id,
            ticketText: job.ticket_text,
          },
        });
      }
    } catch (dbErr) {
      console.warn(
        "⚠️ print_jobs DB next failed, usando cola en memoria:",
        dbErr?.message || dbErr
      );
    }

    // ======================================================
    // 2) Fallback cola memoria
    // ======================================================
    const idx = PRINT_QUEUE.findIndex(
      (j) => j.tenantKey === tenantKey && j.status === "pending"
    );

    if (idx >= 0) {
      const j = PRINT_QUEUE[idx];
      PRINT_QUEUE.splice(idx, 1);

      return res.json({
        job: {
          id: j.id,
          ticketText: j.ticketText,
        },
      });
    }

    return res.json({ job: null });
  } catch (e) {
    console.error("❌ next error:", e);
    return res.json({ job: null });
  }
});

module.exports = router;
