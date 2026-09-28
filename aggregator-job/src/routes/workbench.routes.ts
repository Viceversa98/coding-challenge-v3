import { Request, Response, Router } from "express";
import { z } from "zod";

import { ApiError } from "../errors/apiError";
import {
  createDeduction,
  createProduct,
  createSale,
  createStore,
  deleteDeduction,
  deleteExpense,
  deleteProduct,
  deleteSale,
  deleteStore,
  getOverview,
  listDeductions,
  listExpenses,
  listProducts,
  listSales,
  listStoreRecords,
  updateDeduction,
  updateProduct,
  updateSale,
  updateStore,
} from "../services/workbench.service";
import {
  deductionBodySchema,
  deductionPatchSchema,
  expenseKeySchema,
  pageQuerySchema,
  productBodySchema,
  productPatchSchema,
  saleBodySchema,
  saleKeySchema,
  salePatchSchema,
  storeBodySchema,
  storePatchSchema,
} from "../validators/workbench.validators";

const router = Router();

const read = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "INVALID_REQUEST",
      parsed.error.errors[0]?.message ?? "Invalid request",
    );
  }
  return parsed.data;
};

router.get("/overview", async (req: Request, res: Response) => {
  const storeId =
    typeof req.query.storeId === "string" && req.query.storeId !== ""
      ? read(z.string().regex(/^\d+$/, "Use a numeric id"), req.query.storeId)
      : undefined;
  res.status(200).json(await getOverview(storeId));
});

router.get("/stores", async (_req: Request, res: Response) => {
  res.status(200).json({ stores: await listStoreRecords() });
});

router.post("/stores", async (req: Request, res: Response) => {
  const body = read(storeBodySchema, req.body);
  res.status(201).json(await createStore(body));
});

router.patch("/stores/:storeId", async (req: Request, res: Response) => {
  const storeId = read(
    z.string().regex(/^\d+$/, "Use a numeric id"),
    req.params.storeId,
  );
  const body = read(storePatchSchema, req.body);
  res.status(200).json(await updateStore(storeId, body));
});

router.delete("/stores/:storeId", async (req: Request, res: Response) => {
  const storeId = read(
    z.string().regex(/^\d+$/, "Use a numeric id"),
    req.params.storeId,
  );
  await deleteStore(storeId);
  res.status(204).send();
});

router.get("/products", async (req: Request, res: Response) => {
  const query = read(pageQuerySchema, req.query);
  res
    .status(200)
    .json(await listProducts(query.storeId, query.limit ?? 20, query.offset ?? 0));
});

router.post("/products", async (req: Request, res: Response) => {
  const body = read(productBodySchema, req.body);
  res.status(201).json(await createProduct(body));
});

router.patch("/products/:productId", async (req: Request, res: Response) => {
  const productId = read(
    z.string().regex(/^\d+$/, "Use a numeric id"),
    req.params.productId,
  );
  const body = read(productPatchSchema, req.body);
  res.status(200).json(await updateProduct(productId, body));
});

router.delete("/products/:productId", async (req: Request, res: Response) => {
  const productId = read(
    z.string().regex(/^\d+$/, "Use a numeric id"),
    req.params.productId,
  );
  await deleteProduct(productId);
  res.status(204).send();
});

router.get("/sales", async (req: Request, res: Response) => {
  const query = read(pageQuerySchema, req.query);
  res
    .status(200)
    .json(await listSales(query.storeId, query.limit ?? 20, query.offset ?? 0));
});

router.post("/sales", async (req: Request, res: Response) => {
  const body = read(saleBodySchema, req.body);
  res.status(201).json(await createSale(body));
});

router.patch("/sales", async (req: Request, res: Response) => {
  const body = read(salePatchSchema, req.body);
  res.status(200).json(
    await updateSale(
      {
        productId: body.productId,
        storeId: body.storeId,
        reportDate: body.reportDate,
      },
      body.shippedRevenue,
    ),
  );
});

router.delete("/sales", async (req: Request, res: Response) => {
  const key = read(saleKeySchema, req.query);
  await deleteSale(key);
  res.status(204).send();
});

router.get("/deductions", async (req: Request, res: Response) => {
  const storeId = read(
    z.string().regex(/^\d+$/, "Use a numeric id"),
    req.query.storeId,
  );
  res.status(200).json({ deductions: await listDeductions(storeId) });
});

router.post("/deductions", async (req: Request, res: Response) => {
  const body = read(deductionBodySchema, req.body);
  res.status(201).json(await createDeduction(body));
});

router.patch(
  "/deductions/:deductionId",
  async (req: Request, res: Response) => {
    const deductionId = read(
      z.string().regex(/^\d+$/, "Use a numeric id"),
      req.params.deductionId,
    );
    const body = read(deductionPatchSchema, req.body);
    res.status(200).json(await updateDeduction(deductionId, body));
  },
);

router.delete(
  "/deductions/:deductionId",
  async (req: Request, res: Response) => {
    const deductionId = read(
      z.string().regex(/^\d+$/, "Use a numeric id"),
      req.params.deductionId,
    );
    await deleteDeduction(deductionId);
    res.status(204).send();
  },
);

router.get("/expense-events", async (req: Request, res: Response) => {
  const query = read(pageQuerySchema, req.query);
  res.status(200).json(
    await listExpenses(
      query.storeId,
      query.expenseType,
      query.limit ?? 20,
      query.offset ?? 0,
    ),
  );
});

router.delete("/expense-events", async (req: Request, res: Response) => {
  const key = read(expenseKeySchema, req.body);
  await deleteExpense(key);
  res.status(204).send();
});

export default router;
