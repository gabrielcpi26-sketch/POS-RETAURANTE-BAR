// backend/src/modules/auth/auth.service.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../../db.js";

export async function createAdminUser({ name, email, password }) {
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    throw new Error("Ya existe un usuario con ese email");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "ADMIN",
    },
  });

  // No regresamos el hash
  const { passwordHash: _, ...safeUser } = user;

  return {
    message: "Administrador creado correctamente",
    user: safeUser,
  };
}

export async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    throw new Error("Contraseña incorrecta");
  }

  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  const { passwordHash: _, ...safeUser } = user;

  return {
    message: "Login exitoso",
    token,
    user: safeUser,
  };
}
