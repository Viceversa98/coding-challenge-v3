import {
  DeductionsValidatedRequest,
  deductionValidationMessage,
  deductionsQuerySchema,
} from "../validators/vendors.validators";
import { Response, Router } from "express";

import { listStores } from "../services/catalog.service";
import { processDeduction } from "../services/deduction.service";
import { validateRequest } from "../middleware/validateRequest";
import workbenchRoutes from "./workbench.routes";

const router = Router();

router.use("/workbench", workbenchRoutes);

router.get("/stores", async (_req, res: Response) => {
  const stores = await listStores();
  res.status(200).json({ stores });
});

router.post(
  "/deductions",
  validateRequest(deductionsQuerySchema, "body", {
    invalidRequestMessage: deductionValidationMessage,
  }),
  async (req: DeductionsValidatedRequest, res: Response) => {
    const { storeId, deductionId } = req.validatedData!;
    const result = await processDeduction(storeId, deductionId);

    res.status(200).json(result);
  },
);

export default router;
