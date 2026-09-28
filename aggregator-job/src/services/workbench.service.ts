import type { PoolClient, QueryResultRow } from "pg";

import { pool } from "../config/drizzle";
import { ApiError } from "../errors/apiError";

export type Page<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type Overview = {
  stores: number;
  products: number;
  sales: number;
  deductions: number;
  sellOutEvents: number;
  otherEvents: number;
  earliestSale: string | null;
  latestSale: string | null;
};

export type StoreRecord = {
  storeId: string;
  merchantId: string;
  marketplaceType: string;
  marketplaceSubtype: string;
  marketplaceCountry: string;
  sourceSystemId: string;
  isActive: boolean;
  productCount: number;
  deductionCount: number;
};

export type ProductRecord = {
  productId: string;
  storeId: string;
  sellerSku: string;
  productSku: string;
  title: string;
  price: string;
  brand: string | null;
  fulfilledBy: string;
  isActive: boolean;
};

export type SaleRecord = {
  productId: string;
  storeId: string;
  productSku: string;
  title: string;
  reportDate: string;
  shippedRevenue: string;
  shippedUnits: number;
};

export type DeductionRecord = {
  deductionId: string;
  storeId: string;
  deductionType: string;
  deductionBasis: "FIXED_AMOUNT" | "NET_RECEIPTS";
  deductionValue: string;
  currency: string;
  vendorCode: string | null;
  effectiveDateFrom: string;
  effectiveDateTo: string;
  isActive: boolean;
};

export type ExpenseRecord = {
  storeId: string;
  sourceSystemId: string;
  productSku: string | null;
  expenseDate: string;
  vendorCode: string | null;
  expenseType: string;
  expenseSubtype: string;
  cost: string;
  expenseStatus: string;
  deductionId: string;
  shippedRevenue: string | null;
  revenueAfter: string | null;
};

type StoreInput = {
  merchantId: string;
  marketplaceType: string;
  marketplaceSubtype: string;
  marketplaceCountry: string;
  sourceSystemId: string;
  isActive: boolean;
};

type ProductInput = {
  storeId: string;
  sellerSku: string;
  productSku: string;
  title: string;
  price: string;
  brand: string | null;
  fulfilledBy: string;
  isActive: boolean;
};

type SaleInput = {
  storeId: string;
  productId: string;
  reportDate: string;
  shippedRevenue: string;
};

type DeductionInput = {
  storeId: string;
  deductionType: string;
  deductionBasis: "FIXED_AMOUNT" | "NET_RECEIPTS";
  deductionValue: string;
  currency: string;
  vendorCode: string | null;
  effectiveDateFrom: string;
  effectiveDateTo: string;
  isActive: boolean;
};

type ExpenseKey = {
  storeId: string;
  sourceSystemId: string;
  expenseDate: string;
  expenseType: string;
  expenseSubtype: string;
  deductionId: string;
};

const asText = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
};

const asNumber = (value: unknown): number => Number(value);

const asOptionalText = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
};

const dayStamp = (day: string): string => `${day}T00:00:00.000Z`;

const pgCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }
  if ("cause" in error) {
    return pgCode(error.cause);
  }
  return undefined;
};

const write = async <T extends QueryResultRow>(
  text: string,
  values: unknown[],
): Promise<T[]> => {
  try {
    const result = await pool.query<T>(text, values);
    return result.rows;
  } catch (error) {
    const code = pgCode(error);
    if (code === "23505") {
      throw new ApiError(
        400,
        "INVALID_REQUEST",
        "A record with that identity already exists",
      );
    }
    if (code === "23503") {
      throw new ApiError(
        400,
        "INVALID_REQUEST",
        "That record is still linked to other data",
      );
    }
    throw error;
  }
};

const mapStore = (row: QueryResultRow): StoreRecord => ({
  storeId: asText(row.store_id),
  merchantId: asText(row.merchant_id),
  marketplaceType: asText(row.marketplace_type),
  marketplaceSubtype: asText(row.marketplace_subtype),
  marketplaceCountry: asText(row.marketplace_country),
  sourceSystemId: asText(row.source_system_id),
  isActive: Boolean(row.is_active),
  productCount: asNumber(row.product_count),
  deductionCount: asNumber(row.deduction_count),
});

const mapProduct = (row: QueryResultRow): ProductRecord => ({
  productId: asText(row.product_id),
  storeId: asText(row.store_id),
  sellerSku: asText(row.seller_sku),
  productSku: asText(row.product_sku),
  title: asText(row.title),
  price: asText(row.price),
  brand: asOptionalText(row.brand),
  fulfilledBy: asText(row.fulfilled_by),
  isActive: Boolean(row.is_active),
});

const mapSale = (row: QueryResultRow): SaleRecord => ({
  productId: asText(row.product_id),
  storeId: asText(row.store_id),
  productSku: asText(row.product_sku),
  title: asText(row.title),
  reportDate: asText(row.report_date),
  shippedRevenue: asText(row.shipped_revenue),
  shippedUnits: asNumber(row.shipped_units),
});

const mapDeduction = (row: QueryResultRow): DeductionRecord => ({
  deductionId: asText(row.deduction_id),
  storeId: asText(row.store_id),
  deductionType: asText(row.deduction_type),
  deductionBasis: row.deduction_basis as DeductionRecord["deductionBasis"],
  deductionValue: asText(row.deduction_value),
  currency: asText(row.currency),
  vendorCode: asOptionalText(row.vendor_code),
  effectiveDateFrom: asText(row.effective_date_from),
  effectiveDateTo: asText(row.effective_date_to),
  isActive: Boolean(row.is_active),
});

const mapExpense = (row: QueryResultRow): ExpenseRecord => ({
  storeId: asText(row.store_id),
  sourceSystemId: asText(row.source_system_id),
  productSku: asOptionalText(row.product_sku),
  expenseDate: asText(row.expense_date),
  vendorCode: asOptionalText(row.vendor_code),
  expenseType: asText(row.expense_type),
  expenseSubtype: asText(row.expense_subtype),
  cost: asText(row.cost),
  expenseStatus: asText(row.expense_status),
  deductionId: asText(row.deduction_id),
  shippedRevenue: asOptionalText(row.shipped_revenue),
  revenueAfter: asOptionalText(row.revenue_after),
});

const requireStore = async (storeId: string): Promise<QueryResultRow> => {
  const rows = await pool.query(
    `SELECT store_id, marketplace_type, marketplace_subtype, marketplace_country, source_system_id
     FROM generic.store WHERE store_id = $1`,
    [storeId],
  );
  const store = rows.rows[0];
  if (!store) {
    throw new ApiError(404, "NOT_FOUND", "Store not found");
  }
  return store;
};

const assertDateOrder = (from: string, to: string): void => {
  if (from > to) {
    throw new ApiError(
      400,
      "INVALID_REQUEST",
      "Effective from must be on or before effective to",
    );
  }
};

export const getOverview = async (
  storeId: string | undefined,
): Promise<Overview> => {
  const scoped = storeId !== undefined;
  const values = scoped ? [storeId] : [];
  const storeFilter = scoped ? "WHERE store_id = $1" : "";
  const result = await pool.query(
    `SELECT
       (SELECT count(*) FROM generic.store ${storeFilter}) AS stores,
       (SELECT count(*) FROM generic.product ${storeFilter}) AS products,
       (SELECT count(*) FROM vendor.product_sales ${storeFilter}) AS sales,
       (SELECT count(*) FROM vendor.deductions ${storeFilter}) AS deductions,
       (SELECT count(*) FROM vendor.expense_events ${storeFilter} ${scoped ? "AND" : "WHERE"} expense_type = 'SELL_OUT') AS sell_out_events,
       (SELECT count(*) FROM vendor.expense_events ${storeFilter} ${scoped ? "AND" : "WHERE"} expense_type <> 'SELL_OUT') AS other_events,
       (SELECT min(report_date) FROM vendor.product_sales ${storeFilter}) AS earliest_sale,
       (SELECT max(report_date) FROM vendor.product_sales ${storeFilter}) AS latest_sale`,
    values,
  );
  const row = result.rows[0];
  return {
    stores: asNumber(row?.stores),
    products: asNumber(row?.products),
    sales: asNumber(row?.sales),
    deductions: asNumber(row?.deductions),
    sellOutEvents: asNumber(row?.sell_out_events),
    otherEvents: asNumber(row?.other_events),
    earliestSale: row?.earliest_sale ? asText(row.earliest_sale) : null,
    latestSale: row?.latest_sale ? asText(row.latest_sale) : null,
  };
};

export const listStoreRecords = async (): Promise<StoreRecord[]> => {
  const result = await pool.query(
    `SELECT s.store_id, s.merchant_id, s.marketplace_type, s.marketplace_subtype,
            s.marketplace_country, s.source_system_id, s.is_active,
            (SELECT count(*) FROM generic.product p WHERE p.store_id = s.store_id) AS product_count,
            (SELECT count(*) FROM vendor.deductions d WHERE d.store_id = s.store_id) AS deduction_count
     FROM generic.store s
     ORDER BY s.store_id`,
  );
  return result.rows.map(mapStore);
};

export const createStore = async (input: StoreInput): Promise<StoreRecord> => {
  const rows = await write(
    `INSERT INTO generic.store (
       marketplace_type, marketplace_subtype, marketplace_country, source_system_id,
       merchant_id, is_active, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING store_id, merchant_id, marketplace_type, marketplace_subtype,
               marketplace_country, source_system_id, is_active,
               0::bigint AS product_count, 0::bigint AS deduction_count`,
    [
      input.marketplaceType,
      input.marketplaceSubtype,
      input.marketplaceCountry,
      input.sourceSystemId,
      input.merchantId,
      input.isActive,
    ],
  );
  const created = rows[0];
  if (!created) {
    throw new ApiError(500, "PROCESSING_FAILED", "Store was not created");
  }
  return mapStore(created);
};

export const updateStore = async (
  storeId: string,
  input: Pick<StoreInput, "merchantId" | "isActive">,
): Promise<StoreRecord> => {
  const rows = await write(
    `UPDATE generic.store
     SET merchant_id = $2, is_active = $3, updated_at = NOW()
     WHERE store_id = $1
     RETURNING store_id, merchant_id, marketplace_type, marketplace_subtype,
               marketplace_country, source_system_id, is_active,
               0::bigint AS product_count, 0::bigint AS deduction_count`,
    [storeId, input.merchantId, input.isActive],
  );
  const updated = rows[0];
  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Store not found");
  }
  return mapStore(updated);
};

export const deleteStore = async (storeId: string): Promise<void> => {
  const result = await pool.query(
    "DELETE FROM generic.store WHERE store_id = $1",
    [storeId],
  );
  if (result.rowCount === 0) {
    throw new ApiError(404, "NOT_FOUND", "Store not found");
  }
};

const pageQuery = async <T>(
  listSql: string,
  countSql: string,
  values: unknown[],
  limit: number,
  offset: number,
  map: (row: QueryResultRow) => T,
): Promise<Page<T>> => {
  const [items, counted] = await Promise.all([
    pool.query(listSql, [...values, limit, offset]),
    pool.query(countSql, values),
  ]);
  return {
    items: items.rows.map(map),
    total: asNumber(counted.rows[0]?.total),
    limit,
    offset,
  };
};

export const listProducts = async (
  storeId: string,
  limit: number,
  offset: number,
): Promise<Page<ProductRecord>> => {
  await requireStore(storeId);
  return pageQuery(
    `SELECT product_id, store_id, seller_sku, product_sku, title, price, brand, fulfilled_by, is_active
     FROM generic.product
     WHERE store_id = $1
     ORDER BY product_id
     LIMIT $2 OFFSET $3`,
    "SELECT count(*) AS total FROM generic.product WHERE store_id = $1",
    [storeId],
    limit,
    offset,
    mapProduct,
  );
};

export const createProduct = async (
  input: ProductInput,
): Promise<ProductRecord> => {
  const store = await requireStore(input.storeId);
  const sourceSystemId = `${asText(store.source_system_id)}_${input.sellerSku}`;
  const rows = await write(
    `INSERT INTO generic.product (
       store_id, marketplace_type, marketplace_subtype, marketplace_country, source_system_id,
       seller_sku, product_sku, title, image_url, link_url, price, brand, fulfilled_by,
       is_active, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, $10, $11, $12, $13,
       $14, NOW(), NOW()
     )
     RETURNING product_id, store_id, seller_sku, product_sku, title, price, brand, fulfilled_by, is_active`,
    [
      input.storeId,
      store.marketplace_type,
      store.marketplace_subtype,
      store.marketplace_country,
      sourceSystemId,
      input.sellerSku,
      input.productSku,
      input.title,
      "https://placehold.co/64",
      "https://example.com",
      input.price,
      input.brand,
      input.fulfilledBy,
      input.isActive,
    ],
  );
  const created = rows[0];
  if (!created) {
    throw new ApiError(500, "PROCESSING_FAILED", "Product was not created");
  }
  return mapProduct(created);
};

export const updateProduct = async (
  productId: string,
  input: Omit<ProductInput, "storeId">,
): Promise<ProductRecord> => {
  const rows = await write(
    `UPDATE generic.product
     SET seller_sku = $2, product_sku = $3, title = $4, price = $5, brand = $6,
         fulfilled_by = $7, is_active = $8, updated_at = NOW()
     WHERE product_id = $1
     RETURNING product_id, store_id, seller_sku, product_sku, title, price, brand, fulfilled_by, is_active`,
    [
      productId,
      input.sellerSku,
      input.productSku,
      input.title,
      input.price,
      input.brand,
      input.fulfilledBy,
      input.isActive,
    ],
  );
  const updated = rows[0];
  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Product not found");
  }
  return mapProduct(updated);
};

export const deleteProduct = async (productId: string): Promise<void> => {
  const result = await pool.query(
    "DELETE FROM generic.product WHERE product_id = $1",
    [productId],
  );
  if (result.rowCount === 0) {
    throw new ApiError(404, "NOT_FOUND", "Product not found");
  }
};

export const listSales = async (
  storeId: string,
  limit: number,
  offset: number,
): Promise<Page<SaleRecord>> => {
  await requireStore(storeId);
  return pageQuery(
    `SELECT ps.product_id, ps.store_id, p.product_sku, p.title, ps.report_date,
            ps.shipped_revenue, ps.shipped_units
     FROM vendor.product_sales ps
     JOIN generic.product p ON p.product_id = ps.product_id
     WHERE ps.store_id = $1
     ORDER BY ps.report_date DESC, ps.product_id
     LIMIT $2 OFFSET $3`,
    "SELECT count(*) AS total FROM vendor.product_sales WHERE store_id = $1",
    [storeId],
    limit,
    offset,
    mapSale,
  );
};

export const createSale = async (input: SaleInput): Promise<SaleRecord> => {
  await requireStore(input.storeId);
  const product = await pool.query(
    "SELECT product_id FROM generic.product WHERE product_id = $1 AND store_id = $2",
    [input.productId, input.storeId],
  );
  if (!product.rows[0]) {
    throw new ApiError(404, "NOT_FOUND", "Product not found");
  }

  const shipped = input.shippedRevenue;
  const cogs = (Number(shipped) * 0.6).toFixed(2);
  const reportDate = dayStamp(input.reportDate);
  const rows = await write(
    `INSERT INTO vendor.product_sales (
       product_id, store_id, ordered_revenue, ordered_units, shipped_revenue, shipped_units,
       shipped_cogs, customer_returns, shipped_revenue_total, shipped_units_total,
       shipped_cogs_total, customer_returns_total, report_date, created_at, updated_at
     ) VALUES (
       $1, $2, $3, 1, $3, 1,
       $4, 0, $3, 1,
       $4, 0, $5, NOW(), NOW()
     )
     RETURNING product_id, store_id, report_date, shipped_revenue, shipped_units`,
    [input.productId, input.storeId, shipped, cogs, reportDate],
  );
  const created = rows[0];
  if (!created) {
    throw new ApiError(500, "PROCESSING_FAILED", "Sale was not created");
  }
  const titled = await pool.query(
    `SELECT p.product_sku, p.title FROM generic.product p WHERE p.product_id = $1`,
    [input.productId],
  );
  return mapSale({
    ...created,
    product_sku: titled.rows[0]?.product_sku,
    title: titled.rows[0]?.title,
  });
};

export const updateSale = async (
  key: { productId: string; storeId: string; reportDate: string },
  shippedRevenue: string,
): Promise<SaleRecord> => {
  const cogs = (Number(shippedRevenue) * 0.6).toFixed(2);
  const rows = await write(
    `UPDATE vendor.product_sales
     SET shipped_revenue = $4, shipped_revenue_total = $4, ordered_revenue = $4,
         shipped_cogs = $5, shipped_cogs_total = $5, updated_at = NOW()
     WHERE product_id = $1 AND store_id = $2 AND report_date = $3
     RETURNING product_id, store_id, report_date, shipped_revenue, shipped_units`,
    [key.productId, key.storeId, key.reportDate, shippedRevenue, cogs],
  );
  const updated = rows[0];
  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Sale not found");
  }
  const titled = await pool.query(
    "SELECT product_sku, title FROM generic.product WHERE product_id = $1",
    [key.productId],
  );
  return mapSale({
    ...updated,
    product_sku: titled.rows[0]?.product_sku,
    title: titled.rows[0]?.title,
  });
};

export const deleteSale = async (key: {
  productId: string;
  storeId: string;
  reportDate: string;
}): Promise<void> => {
  const result = await pool.query(
    `DELETE FROM vendor.product_sales
     WHERE product_id = $1 AND store_id = $2 AND report_date = $3`,
    [key.productId, key.storeId, key.reportDate],
  );
  if (result.rowCount === 0) {
    throw new ApiError(404, "NOT_FOUND", "Sale not found");
  }
};

export const listDeductions = async (
  storeId: string,
): Promise<DeductionRecord[]> => {
  await requireStore(storeId);
  const result = await pool.query(
    `SELECT deduction_id, store_id, deduction_type, deduction_basis, deduction_value,
            currency, vendor_code, effective_date_from, effective_date_to, is_active
     FROM vendor.deductions
     WHERE store_id = $1
     ORDER BY deduction_id`,
    [storeId],
  );
  return result.rows.map(mapDeduction);
};

export const createDeduction = async (
  input: DeductionInput,
): Promise<DeductionRecord> => {
  await requireStore(input.storeId);
  assertDateOrder(input.effectiveDateFrom, input.effectiveDateTo);
  const rows = await write(
    `INSERT INTO vendor.deductions (
       store_id, deduction_type, deduction_basis, deduction_value, currency, vendor_code,
       effective_date_from, effective_date_to, is_active, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
     RETURNING deduction_id, store_id, deduction_type, deduction_basis, deduction_value,
               currency, vendor_code, effective_date_from, effective_date_to, is_active`,
    [
      input.storeId,
      input.deductionType,
      input.deductionBasis,
      input.deductionValue,
      input.currency,
      input.vendorCode,
      dayStamp(input.effectiveDateFrom),
      dayStamp(input.effectiveDateTo),
      input.isActive,
    ],
  );
  const created = rows[0];
  if (!created) {
    throw new ApiError(500, "PROCESSING_FAILED", "Deduction was not created");
  }
  return mapDeduction(created);
};

export const updateDeduction = async (
  deductionId: string,
  input: Omit<DeductionInput, "storeId">,
): Promise<DeductionRecord> => {
  assertDateOrder(input.effectiveDateFrom, input.effectiveDateTo);
  const rows = await write(
    `UPDATE vendor.deductions
     SET deduction_type = $2, deduction_basis = $3, deduction_value = $4, currency = $5,
         vendor_code = $6, effective_date_from = $7, effective_date_to = $8,
         is_active = $9, updated_at = NOW()
     WHERE deduction_id = $1
     RETURNING deduction_id, store_id, deduction_type, deduction_basis, deduction_value,
               currency, vendor_code, effective_date_from, effective_date_to, is_active`,
    [
      deductionId,
      input.deductionType,
      input.deductionBasis,
      input.deductionValue,
      input.currency,
      input.vendorCode,
      dayStamp(input.effectiveDateFrom),
      dayStamp(input.effectiveDateTo),
      input.isActive,
    ],
  );
  const updated = rows[0];
  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Deduction not found");
  }
  return mapDeduction(updated);
};

const withClient = async <T>(
  action: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const deleteDeduction = async (deductionId: string): Promise<void> => {
  const removed = await withClient(async (client) => {
    await client.query(
      `DELETE FROM vendor.expense_events
       WHERE deduction_id = $1 AND expense_type = 'SELL_OUT'`,
      [deductionId],
    );
    return client.query(
      "DELETE FROM vendor.deductions WHERE deduction_id = $1",
      [deductionId],
    );
  });
  if (removed.rowCount === 0) {
    throw new ApiError(404, "NOT_FOUND", "Deduction not found");
  }
};

export const listExpenses = async (
  storeId: string,
  expenseType: string | undefined,
  limit: number,
  offset: number,
): Promise<Page<ExpenseRecord>> => {
  await requireStore(storeId);
  const values: unknown[] = [storeId];
  if (expenseType) {
    values.push(expenseType);
  }
  const typeSql = expenseType ? ` AND expense_type = $${values.length}` : "";
  const listTypeSql = expenseType ? ` AND e.expense_type = $${values.length}` : "";
  return pageQuery(
    `SELECT e.store_id, e.source_system_id, e.product_sku, e.expense_date, e.vendor_code,
            e.expense_type, e.expense_subtype, e.cost, e.expense_status, e.deduction_id,
            sale.shipped_revenue,
            CASE
              WHEN sale.shipped_revenue IS NULL THEN NULL
              ELSE ROUND(sale.shipped_revenue - e.cost, 2)
            END AS revenue_after
     FROM vendor.expense_events e
     LEFT JOIN LATERAL (
       SELECT s.shipped_revenue
       FROM generic.product p
       JOIN vendor.product_sales s
         ON s.store_id = e.store_id
        AND s.product_id = p.product_id
        AND s.report_date = e.expense_date
       WHERE p.store_id = e.store_id
         AND p.source_system_id = e.source_system_id
       LIMIT 1
     ) sale ON true
     WHERE e.store_id = $1${listTypeSql}
     ORDER BY e.expense_date DESC, e.expense_subtype
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    `SELECT count(*) AS total FROM vendor.expense_events WHERE store_id = $1${typeSql}`,
    values,
    limit,
    offset,
    mapExpense,
  );
};

export const deleteExpense = async (key: ExpenseKey): Promise<void> => {
  const result = await pool.query(
    `DELETE FROM vendor.expense_events
     WHERE store_id = $1 AND source_system_id = $2 AND expense_date = $3
       AND expense_type = $4 AND expense_subtype = $5 AND deduction_id = $6`,
    [
      key.storeId,
      key.sourceSystemId,
      key.expenseDate,
      key.expenseType,
      key.expenseSubtype,
      key.deductionId,
    ],
  );
  if (result.rowCount === 0) {
    throw new ApiError(404, "NOT_FOUND", "Expense event not found");
  }
};
