// backend/src/modules/auth/auth.controller.js
import { createAdminUser, loginUser } from "./auth.service.js";

export async function registerAdmin(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Nombre, email y password son obligatorios" });
    }

    const result = await createAdminUser({ name, email, password });
    res.json(result);
  } catch (error) {
    console.error("Error en registerAdmin:", error);
    res.status(400).json({ error: error.message || "Error al crear admin" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email y password son obligatorios" });
    }

    const result = await loginUser({ email, password });
    res.json(result);
  } catch (error) {
    console.error("Error en login:", error);
    res.status(400).json({ error: error.message || "Error al iniciar sesión" });
  }
}
