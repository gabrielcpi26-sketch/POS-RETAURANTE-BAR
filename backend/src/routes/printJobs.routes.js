const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Cola fallback (por si no existe tabla o falla SQL)
const PRINT_QUEUE = [];

// Para NO spamear logs
let warnedPrintJobs = false;
let warnedPrintJob = false;

function getTenantKey(req) {
  return (
    req.tenantKey ||
    req.headers["x-tenant-key"] ||
    req.headers["x-tenant"] ||
    req.headers["x-tenant-id"] ||
    "default"
  )
    .toString()
    .trim()
    .toLowerCase();
}

// ===========================
// POST /api/print-jobs/close-ticket
// Body: { ticketText: "...." }
// ===========================
router.post("/close-ticket", async (req, res) => {
  try {
    const tenantKey = getTenantKey(req);
    const { ticketText } = req.body || {};

    if (!ticketText) return res.status(400).json({ error: "ticketText required" });

    // ======================================================
    // ✅ ANTI-DUPLICADO (ventana corta)
    // 1) intenta print_jobs (snake)
    // 2) si no existe, intenta "PrintJob" (camel)
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
      if (Array.isArray(dup) && dup.length > 0) return res.json({ ok: true, dedup: true });
    } catch (e1) {
      // si falla porque no existe print_jobs, probamos PrintJob
      try {
        const dup2 = await prisma.$queryRaw`
          SELECT id
          FROM "PrintJob"
          WHERE "tenantId" = ${tenantKey}
            AND type = ${"close_ticket"}
            AND payload::text = ${JSON.stringify({ ticketText: String(ticketText) })}
            AND "createdAt" >= NOW() - INTERVAL '10 seconds'
          ORDER BY id DESC
          LIMIT 1
        `;
        if (Array.isArray(dup2) && dup2.length > 0) return res.json({ ok: true, dedup: true });
      } catch (e2) {
        // no rompemos flujo
      }
    }

    // ======================================================
    // 1) Intento DB real: print_jobs (snake_case)
    // ======================================================
    try {
      await prisma.$executeRaw`
        INSERT INTO print_jobs (tenant_key, type, ticket_text, status)
        VALUES (${tenantKey}, ${"close_ticket"}, ${String(ticketText)}, ${"pending"})
      `;
    } catch (dbErr1) {
      if (!warnedPrintJobs) {
        warnedPrintJobs = true;
        console.warn("⚠️ print_jobs insert failed (probando PrintJob / fallback):", dbErr1?.message || dbErr1);
      }

      // ======================================================
      // 2) Intento DB alterna: "PrintJob" (CamelCase) usando payload
      // ======================================================
      try {
        await prisma.$executeRaw`
          INSERT INTO "PrintJob" ("tenantId", type, payload, status)
          VALUES (${tenantKey}, ${"close_ticket"}, ${JSON.stringify({ ticketText: String(ticketText) })}::jsonb, ${"pending"})
        `;
      } catch (dbErr2) {
        if (!warnedPrintJob) {
          warnedPrintJob = true;
          console.warn("⚠️ PrintJob insert failed, usando cola en memoria:", dbErr2?.message || dbErr2);
        }

        // ======================================================
        // 3) Fallback cola memoria
        // ======================================================
        PRINT_QUEUE.push({
          id: Date.now(),
          tenantKey,
          type: "close_ticket",
          ticketText: String(ticketText),
          status: "pending",
          createdAt: new Date().toISOString(),
        });
      }
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("❌ close-ticket error:", e);
    return res.json({ ok: true });
  }
});

// ===========================
// GET /api/print-jobs/next
// Devuelve siguiente pending del tenant
// ===========================
router.get("/next", async (req, res) => {
  try {
    const tenantKey = getTenantKey(req);

    // ======================================================
    // 1) Intento DB: print_jobs (snake)
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
        await prisma.$executeRaw`
          UPDATE print_jobs
          SET status = ${"printed"}
          WHERE id = ${job.id}
        `;

        return res.json({ job: { id: job.id, ticketText: job.ticket_text } });
      }
    } catch (dbErr1) {
      // print_jobs no existe en este entorno, probamos PrintJob
    }

    // ======================================================
    // 2) Intento DB alterna: "PrintJob" (CamelCase)
    // payload trae { ticketText }
    // ======================================================
    try {
      const rows2 = await prisma.$queryRaw`
        SELECT id, payload
        FROM "PrintJob"
        WHERE "tenantId" = ${tenantKey}
          AND status = ${"pending"}
          AND type = ${"close_ticket"}
        ORDER BY id ASC
        LIMIT 1
      `;

      const job2 = Array.isArray(rows2) && rows2.length ? rows2[0] : null;

      if (job2?.id) {
        await prisma.$executeRaw`
          UPDATE "PrintJob"
          SET status = ${"printed"}, "printedAt" = NOW()
          WHERE id = ${job2.id}
        `;

        const payload = job2.payload || {};
        return res.json({ job: { id: job2.id, ticketText: payload.ticketText || "" } });
      }
    } catch (dbErr2) {
      // no rompemos flujo
    }

    // ======================================================
    // 3) Fallback cola memoria
    // ======================================================
    const idx = PRINT_QUEUE.findIndex((j) => j.tenantKey === tenantKey && j.status === "pending");
    if (idx >= 0) {
      const j = PRINT_QUEUE[idx];
      PRINT_QUEUE.splice(idx, 1);
      return res.json({ job: { id: j.id, ticketText: j.ticketText } });
    }

    return res.json({ job: null });
  } catch (e) {
    console.error("❌ next error:", e);
    return res.json({ job: null });
  }
});

module.exports = router;
