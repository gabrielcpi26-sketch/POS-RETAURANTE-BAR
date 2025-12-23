// backend/src/server.js
const express = require("express");
const cors = require("cors");

// Rutas
const authRoutes = require("./routes/auth.routes");
const areasRoutes = require("./routes/areas.routes");
const tablesRoutes = require("./routes/tables.routes");
const ordersRoutes = require("./routes/orders.routes");
const reportsRoutes = require("./routes/reports.routes");
const inventoryRoutes = require("./routes/inventory.routes");

const app = express();

// CORS (IMPORTANTE: permitir Vercel + Render + localhost)
app.use(
  cors({
    origin: (origin, cb) => {
      // Permite llamadas sin origin (Postman, server-to-server)
      if (!origin) return cb(null, true);

      const allowed = [
        "http://localhost:5173",
        "https://pos-restaurante-bar.vercel.app",
        "https://pos-restaurante-bar.onrender.com",
      ];

      // Permite previews de Vercel también (opcional pero útil)
      if (allowed.includes(origin) || origin.endsWith(".vercel.app")) {
        return cb(null, true);
      }

      return cb(new Error("Not allowed by CORS: " + origin));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Por si el navegador manda preflight
app.options("*", cors());

app.use(express.json());

// Health checks
app.get("/", (req, res) => {
  res.send("OK - POS backend running");
});

app.get("/api", (req, res) => {
  res.json({ ok: true });
});

app.get("/__ping", (req, res) => {
  res.json({ ok: true });
});

// Montar routers (SIN duplicados)
app.use("/api/auth", authRoutes);
app.use("/api/areas", areasRoutes);
app.use("/api/tables", tablesRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/inventory", inventoryRoutes);

// Puerto
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor POS-Multi-Bar escuchando en http://localhost:${PORT}`);
});
