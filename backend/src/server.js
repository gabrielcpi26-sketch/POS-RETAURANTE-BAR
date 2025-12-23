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

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://pos-restaurante-bar.onrender.com", // (si alguna vez abres frontend ahí)
  "https://pos-restaurante-bar.vercel.app",
  "https://pos-restaurante-bar-git-main-gabrielcpi26-sketchs-projects.vercel.app",
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Permite herramientas sin origin (Postman, curl, healthchecks)
      if (!origin) return cb(null, true);

      // Permite lista fija
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);

      // Permite cualquier preview de Vercel (*.vercel.app)
      if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return cb(null, true);

      return cb(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Health checks
app.get("/", (req, res) => res.send("OK - POS backend running"));
app.get("/api", (req, res) => res.json({ ok: true }));
app.get("/__ping", (req, res) => res.json({ ok: true }));

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/areas", areasRoutes);
app.use("/api/tables", tablesRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/inventory", inventoryRoutes);

// Puerto
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor POS-Multi-Bar escuchando en http://localhost:${PORT}`);
});
