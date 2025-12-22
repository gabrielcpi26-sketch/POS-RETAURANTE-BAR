// backend/src/modules/tables/tables.routes.js
import { Router } from "express";
import {
  createTableController,
  listTablesByAreaController,
} from "./tables.controller.js";

const router = Router();

// Crear mesa
router.post("/", createTableController);

// Listar mesas por área
router.get("/by-area/:areaId", listTablesByAreaController);

export default router;
