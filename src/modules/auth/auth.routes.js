// backend/src/modules/auth/auth.routes.js
import { Router } from "express";
import { registerAdmin, login } from "./auth.controller.js";

const router = Router();

// Crear primer admin (solo para inicio / pruebas)
router.post("/register-admin", registerAdmin);

// Login con email + password
router.post("/login", login);

export default router;
