import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./modules/auth/auth.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Rutas
app.use("/api/auth", authRoutes);

// Ruta base para probar
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Backend POS funcionando" });
});

export default app;
