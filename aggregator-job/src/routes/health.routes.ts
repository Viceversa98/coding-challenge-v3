import { Request, Response, Router } from "express";

import { getCurrentTimestamp } from "../utils/dateUtils";
import { sequelize } from "../config/database";

const router = Router();
//remove health from the path
router.get("/", async (_req: Request, res: Response) => {
  const timestamp = getCurrentTimestamp();

  try {
    await sequelize.authenticate();

    res.status(200).json({
      status: "ok",
      timestamp,
      database: "connected",
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      timestamp,
      database: "disconnected",
    });
  }
});

export default router;
