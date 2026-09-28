import { z } from "zod";

const id = z
  .string()
  .regex(/^\d+$/, "Use a numeric id")
  .max(19);

const money = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Use a number with up to 2 decimal places");

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

const textField = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(120);

export const pageQuerySchema = z.object({
  storeId: id,
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  expenseType: z.string().trim().min(1).max(40).optional(),
});

export const storeBodySchema = z.object({
  merchantId: textField("Merchant id"),
  marketplaceType: textField("Marketplace"),
  marketplaceSubtype: textField("Subtype"),
  marketplaceCountry: textField("Country"),
  sourceSystemId: textField("Source system id"),
  isActive: z.boolean(),
});

export const storePatchSchema = z.object({
  merchantId: textField("Merchant id"),
  isActive: z.boolean(),
});

export const productBodySchema = z.object({
  storeId: id,
  sellerSku: textField("Seller SKU"),
  productSku: textField("Product SKU"),
  title: textField("Title"),
  price: money,
  brand: z.string().trim().max(80).nullable(),
  fulfilledBy: z.enum(["FBA", "FBM"]),
  isActive: z.boolean(),
});

export const productPatchSchema = productBodySchema.omit({ storeId: true });

export const saleBodySchema = z.object({
  storeId: id,
  productId: id,
  reportDate: day,
  shippedRevenue: money,
});

export const salePatchSchema = z.object({
  productId: id,
  storeId: id,
  reportDate: z.string().min(1),
  shippedRevenue: money,
});

export const saleKeySchema = z.object({
  productId: id,
  storeId: id,
  reportDate: z.string().min(1),
});

export const deductionBodySchema = z.object({
  storeId: id,
  deductionType: textField("Deduction type"),
  deductionBasis: z.enum(["NET_RECEIPTS", "FIXED_AMOUNT"]),
  deductionValue: money,
  currency: textField("Currency").max(8),
  vendorCode: z.string().trim().max(40).nullable(),
  effectiveDateFrom: day,
  effectiveDateTo: day,
  isActive: z.boolean(),
});

export const deductionPatchSchema = deductionBodySchema.omit({
  storeId: true,
});

export const expenseKeySchema = z.object({
  storeId: id,
  sourceSystemId: textField("Source system id"),
  expenseDate: z.string().min(1),
  expenseType: textField("Expense type"),
  expenseSubtype: textField("Expense subtype"),
  deductionId: id,
});
