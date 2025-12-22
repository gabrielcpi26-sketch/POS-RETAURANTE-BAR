// backend/src/modules/areas/areas.routes.js
import { Router } from "express";
import {
  createAreaController,
  listAreasController,
} from "./areas.controller.js";

const router = Router();

// Crear salón/área
router.post("/", createAreaController);

// Listar salones/áreas (con sus mesas)
router.get("/", listAreasController);

export default router;
