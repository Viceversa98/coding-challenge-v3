import {
  and,
  asc,
  eq,
  gt,
  gte,
  lt,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";

import { db } from "../config/drizzle";
import * as schema from "../db/schema";
import {
  deductions,
  expenseEvents,
  productSales,
  products,
  stores,
} from "../db/schema";
import { ApiError } from "../errors/apiError";
import { logger } from "../utils/logger";

const BATCH_SIZE = 5000;
const POSTGRES_BIGINT_MAX = 9223372036854775807n;
const SUCCESS_MESSAGE = "Deductions processed succesfully";
const UNSUPPORTED_BASIS_MESSAGE = "Deduction basis must be NET_RECEIPTS";
const WRONG_STORE_MESSAGE = "Deduction does not belong to this store";

export const sellOutEventConflictTarget = [
  expenseEvents.storeId,
  expenseEvents.sourceSystemId,
  expenseEvents.expenseDate,
  expenseEvents.expenseType,
  expenseEvents.expenseSubtype,
  expenseEvents.deductionId,
];

type DeductionTx = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

type SaleKey = {
  productId: bigint;
  reportDate: string;
};

type DeductionRow = {
  deductionId: bigint;
  storeId: bigint;
  deductionType: string;
  deductionBasis: "FIXED_AMOUNT" | "NET_RECEIPTS";
  deductionValue: string;
  vendorCode: string | null;
  effectiveDateFrom: string;
  effectiveDateTo: string;
  isActive: boolean;
};

export type ProcessDeductionResult = {
  status: "success";
  message: typeof SUCCESS_MESSAGE;
  expenseEventsRemoved: number;
  expenseEventsCreated: number;
  expenseEventsUpdated: number;
};

const parseNumericId = (
  value: string,
  field: "storeId" | "deductionId",
): bigint => {
  if (!/^\d+$/.test(value)) {
    throw new ApiError(400, "INVALID_REQUEST", `Invalid ${field}`);
  }

  const parsed = BigInt(value);
  if (parsed > POSTGRES_BIGINT_MAX) {
    throw new ApiError(400, "INVALID_REQUEST", `Invalid ${field}`);
  }

  return parsed;
};

const failureDetails = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const keyIdentity = (key: SaleKey): string =>
  `${key.reportDate}\u0000${key.productId.toString()}`;

const loadSaleKeys = (
  tx: DeductionTx,
  storeId: bigint,
  effectiveDateFrom: string,
  effectiveDateTo: string,
  cursor: SaleKey | undefined,
) => {
  const cursorPredicate = cursor
    ? sql`(${productSales.reportDate}, ${productSales.productId}) > (${cursor.reportDate}::timestamptz, ${cursor.productId.toString()}::bigint)`
    : undefined;

  return tx
    .select({
      productId: productSales.productId,
      reportDate: productSales.reportDate,
    })
    .from(productSales)
    .where(
      and(
        eq(productSales.storeId, storeId),
        gte(productSales.reportDate, effectiveDateFrom),
        lte(productSales.reportDate, effectiveDateTo),
        cursorPredicate,
      ),
    )
    .orderBy(asc(productSales.reportDate), asc(productSales.productId))
    .limit(BATCH_SIZE);
};

const countWriteResults = (
  written: { inserted: boolean | string | null }[],
): { created: number; updated: number } => {
  let created = 0;
  let updated = 0;

  for (const row of written) {
    if (row.inserted === true || row.inserted === "t") {
      created += 1;
    } else {
      updated += 1;
    }
  }

  return { created, updated };
};

const upsertSaleBatch = async (
  tx: DeductionTx,
  storeId: bigint,
  deductionId: bigint,
  effectiveDateFrom: string,
  effectiveDateTo: string,
  keys: SaleKey[],
): Promise<{ created: number; updated: number }> => {
  const keyTuples = sql.join(
    keys.map(
      (key) =>
        sql`(${key.reportDate}::timestamptz, ${key.productId.toString()}::bigint)`,
    ),
    sql`, `,
  );

  const salesSelect = tx
    .select({
      storeId: productSales.storeId,
      sourceSystemId: products.sourceSystemId,
      productSku: products.productSku,
      expenseDate: productSales.reportDate,
      vendorCode: deductions.vendorCode,
      expenseType: sql<string>`'SELL_OUT'`.as("expense_type"),
      expenseSubtype: deductions.deductionType,
      cost: sql`ROUND(${productSales.shippedRevenue} * ${deductions.deductionValue}, 2)`.as(
        "cost",
      ),
      expenseStatus: sql<string>`'CONFIRMED'`.as("expense_status"),
      deductionId: deductions.deductionId,
      createdAt: sql`NOW()`.as("created_at"),
      updatedAt: sql`NOW()`.as("updated_at"),
    })
    .from(productSales)
    .innerJoin(products, eq(products.productId, productSales.productId))
    .innerJoin(
      deductions,
      and(
        eq(deductions.deductionId, deductionId),
        eq(deductions.storeId, storeId),
      ),
    )
    .where(
      and(
        eq(productSales.storeId, storeId),
        gte(productSales.reportDate, effectiveDateFrom),
        lte(productSales.reportDate, effectiveDateTo),
        sql`(${productSales.reportDate}, ${productSales.productId}) IN (${keyTuples})`,
      ),
    );

  const written = await tx
    .insert(expenseEvents)
    .select(salesSelect)
    .onConflictDoUpdate({
      target: [...sellOutEventConflictTarget],
      set: {
        cost: sql`excluded.cost`,
        productSku: sql`excluded.product_sku`,
        vendorCode: sql`excluded.vendor_code`,
        deductionId: sql`excluded.deduction_id`,
        updatedAt: sql`NOW()`,
      },
    })
    .returning({ inserted: sql<boolean>`(xmax = 0)` });

  return countWriteResults(written);
};

const sellOutRowsForDeduction = (storeId: bigint, deductionId: bigint) =>
  and(
    eq(expenseEvents.storeId, storeId),
    eq(expenseEvents.deductionId, deductionId),
    eq(expenseEvents.expenseType, "SELL_OUT"),
  );

const deleteStaleSellOutRows = (
  tx: DeductionTx,
  storeId: bigint,
  deductionId: bigint,
  isActive: boolean,
  effectiveDateFrom: string,
  effectiveDateTo: string,
) =>
  tx.delete(expenseEvents).where(
    and(
      eq(expenseEvents.storeId, storeId),
      eq(expenseEvents.deductionId, deductionId),
      eq(expenseEvents.expenseType, "SELL_OUT"),
      or(
        sql`${isActive} = false`,
        lt(expenseEvents.expenseDate, effectiveDateFrom),
        gt(expenseEvents.expenseDate, effectiveDateTo),
        notExists(
          tx
            .select({ one: sql`1` })
            .from(productSales)
            .innerJoin(products, eq(products.productId, productSales.productId))
            .where(
              and(
                eq(productSales.storeId, expenseEvents.storeId),
                eq(productSales.reportDate, expenseEvents.expenseDate),
                eq(products.sourceSystemId, expenseEvents.sourceSystemId),
                gte(productSales.reportDate, effectiveDateFrom),
                lte(productSales.reportDate, effectiveDateTo),
              ),
            ),
        ),
      ),
    ),
  );

const replaceSellOutEvents = async (
  storeId: bigint,
  deduction: DeductionRow,
): Promise<
  Pick<
    ProcessDeductionResult,
    "expenseEventsRemoved" | "expenseEventsCreated" | "expenseEventsUpdated"
  >
> =>
  db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL statement_timeout = '120s'`);

    const deleted = await deleteStaleSellOutRows(
      tx,
      storeId,
      deduction.deductionId,
      deduction.isActive,
      deduction.effectiveDateFrom,
      deduction.effectiveDateTo,
    );
    const expenseEventsRemoved = deleted.rowCount ?? 0;

    if (!deduction.isActive) {
      return {
        expenseEventsRemoved,
        expenseEventsCreated: 0,
        expenseEventsUpdated: 0,
      };
    }

    let cursor: SaleKey | undefined;
    let batchNumber = 0;
    let expenseEventsCreated = 0;
    let expenseEventsUpdated = 0;

    for (;;) {
      const keys = await loadSaleKeys(
        tx,
        storeId,
        deduction.effectiveDateFrom,
        deduction.effectiveDateTo,
        cursor,
      );

      if (keys.length === 0) {
        break;
      }

      const lastKey = keys[keys.length - 1];
      if (cursor && keyIdentity(lastKey) === keyIdentity(cursor)) {
        throw new Error("Deduction batch cursor did not advance");
      }

      batchNumber += 1;
      const written = await upsertSaleBatch(
        tx,
        storeId,
        deduction.deductionId,
        deduction.effectiveDateFrom,
        deduction.effectiveDateTo,
        keys,
      );
      expenseEventsCreated += written.created;
      expenseEventsUpdated += written.updated;

      logger.info("Processed deduction batch", {
        storeId: storeId.toString(),
        deductionId: deduction.deductionId.toString(),
        batchNumber,
        batchSize: keys.length,
      });

      cursor = lastKey;
      if (keys.length < BATCH_SIZE) {
        break;
      }
    }

    return {
      expenseEventsRemoved,
      expenseEventsCreated,
      expenseEventsUpdated,
    };
  });

export const processDeduction = async (
  storeIdInput: string,
  deductionIdInput: string,
): Promise<ProcessDeductionResult> => {
  const startedAt = Date.now();

  try {
    const storeId = parseNumericId(storeIdInput, "storeId");
    const deductionId = parseNumericId(deductionIdInput, "deductionId");

    const [store] = await db
      .select({ storeId: stores.storeId })
      .from(stores)
      .where(eq(stores.storeId, storeId))
      .limit(1);

    if (!store) {
      logger.info("Store not found for deduction processing", {
        storeId: storeId.toString(),
        deductionId: deductionId.toString(),
      });
      throw new ApiError(404, "NOT_FOUND", "Store not found");
    }

    const [deduction] = await db
      .select({
        deductionId: deductions.deductionId,
        storeId: deductions.storeId,
        deductionType: deductions.deductionType,
        deductionBasis: deductions.deductionBasis,
        deductionValue: deductions.deductionValue,
        vendorCode: deductions.vendorCode,
        effectiveDateFrom: deductions.effectiveDateFrom,
        effectiveDateTo: deductions.effectiveDateTo,
        isActive: deductions.isActive,
      })
      .from(deductions)
      .where(eq(deductions.deductionId, deductionId))
      .limit(1);

    if (!deduction) {
      logger.info("Deduction not found", {
        storeId: storeId.toString(),
        deductionId: deductionId.toString(),
      });
      throw new ApiError(404, "NOT_FOUND", "Deduction not found");
    }

    if (deduction.storeId !== storeId) {
      logger.info("Deduction belongs to a different store", {
        storeId: storeId.toString(),
        deductionId: deductionId.toString(),
        deductionStoreId: deduction.storeId.toString(),
      });
      throw new ApiError(400, "INVALID_REQUEST", WRONG_STORE_MESSAGE);
    }

    logger.info("Processing deduction", {
      storeId: storeId.toString(),
      deductionId: deductionId.toString(),
      basis: deduction.deductionBasis,
      isActive: deduction.isActive,
      effectiveDateFrom: deduction.effectiveDateFrom,
      effectiveDateTo: deduction.effectiveDateTo,
    });

    if (deduction.deductionBasis !== "NET_RECEIPTS") {
      const deleted = await db
        .delete(expenseEvents)
        .where(sellOutRowsForDeduction(storeId, deduction.deductionId));
      const expenseEventsRemoved = deleted.rowCount ?? 0;

      logger.info("Removed SELL_OUT events for unsupported deduction basis", {
        storeId: storeId.toString(),
        deductionId: deductionId.toString(),
        basis: deduction.deductionBasis,
        expenseEventsRemoved,
      });
      throw new ApiError(400, "INVALID_REQUEST", UNSUPPORTED_BASIS_MESSAGE);
    }

    const counts = await replaceSellOutEvents(storeId, deduction);
    const durationMs = Date.now() - startedAt;

    logger.info("Deduction processed", {
      storeId: storeId.toString(),
      deductionId: deductionId.toString(),
      basis: deduction.deductionBasis,
      isActive: deduction.isActive,
      effectiveDateFrom: deduction.effectiveDateFrom,
      effectiveDateTo: deduction.effectiveDateTo,
      expenseEventsRemoved: counts.expenseEventsRemoved,
      expenseEventsCreated: counts.expenseEventsCreated,
      expenseEventsUpdated: counts.expenseEventsUpdated,
      durationMs,
    });

    return {
      status: "success",
      message: SUCCESS_MESSAGE,
      ...counts,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    const details = failureDetails(error);
    logger.error("Deduction processing failed", {
      storeId: storeIdInput,
      deductionId: deductionIdInput,
      details,
      durationMs: Date.now() - startedAt,
    });
    throw new ApiError(
      500,
      "PROCESSING_FAILED",
      `Failed to process deduction: ${details}`,
    );
  }
};
