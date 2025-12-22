// src/routes/auth.routes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

/**
 * POST /api/auth/register-admin
 * Crea el usuario administrador inicial
 */
router.post("/register-admin", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    // ¿Ya existe ese correo?
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return res
        .status(400)
        .json({ error: "Ya existe un usuario con ese correo" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "ADMIN",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({
      message: "Administrador creado correctamente",
      user,
    });
  } catch (err) {
    console.error("Error en /register-admin:", err);
    return res
      .status(500)
      .json({ error: "Error al crear administrador" });
  }
});

/**
 * POST /api/auth/login
 * Login sencillo para el admin
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Correo y contraseña requeridos" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    // Aquí podrías generar JWT, pero por ahora regresamos datos básicos
    return res.json({
      message: `Login correcto, bienvenida ${user.name}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Error en /login:", err);
    return res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

module.exports = router;
