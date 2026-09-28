import {
  bigint,
  boolean,
  decimal,
  pgEnum,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/** Created in public by Flyway, not under vendor. */
export const deductionBasisEnum = pgEnum("deduction_basis_enum", [
  "FIXED_AMOUNT",
  "NET_RECEIPTS",
]);

const genericSchema = pgSchema("generic");
const vendorSchema = pgSchema("vendor");

const timestamptz = (columnName: string) =>
  timestamp(columnName, { withTimezone: true, mode: "string" });

export const stores = genericSchema.table(
  "store",
  {
    storeId: bigint("store_id", { mode: "bigint" }).notNull(),
    marketplaceType: text("marketplace_type").notNull(),
    marketplaceSubtype: text("marketplace_subtype").notNull(),
    marketplaceCountry: text("marketplace_country").notNull(),
    sourceSystemId: text("source_system_id").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [
        table.marketplaceType,
        table.marketplaceSubtype,
        table.marketplaceCountry,
        table.sourceSystemId,
      ],
    }),
    storeIdKey: unique().on(table.storeId),
  }),
);

export const products = genericSchema.table(
  "product",
  {
    productId: bigint("product_id", { mode: "bigint" }).notNull(),
    storeId: bigint("store_id", { mode: "bigint" }).notNull(),
    marketplaceType: text("marketplace_type").notNull(),
    marketplaceSubtype: text("marketplace_subtype").notNull(),
    marketplaceCountry: text("marketplace_country").notNull(),
    sourceSystemId: text("source_system_id").notNull(),
    productSku: text("product_sku").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [
        table.marketplaceType,
        table.marketplaceSubtype,
        table.marketplaceCountry,
        table.sourceSystemId,
      ],
    }),
    productIdKey: unique().on(table.productId),
  }),
);

export const productSales = vendorSchema.table(
  "product_sales",
  {
    productId: bigint("product_id", { mode: "bigint" }).notNull(),
    storeId: bigint("store_id", { mode: "bigint" }).notNull(),
    shippedRevenue: decimal("shipped_revenue", {
      precision: 13,
      scale: 2,
    }).notNull(),
    reportDate: timestamptz("report_date").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.productId, table.storeId, table.reportDate],
    }),
  }),
);

export const deductions = vendorSchema.table("deductions", {
  deductionId: bigint("deduction_id", { mode: "bigint" })
    .primaryKey()
    .notNull(),
  storeId: bigint("store_id", { mode: "bigint" }).notNull(),
  deductionType: text("deduction_type").notNull(),
  deductionBasis: deductionBasisEnum("deduction_basis").notNull(),
  deductionValue: decimal("deduction_value", {
    precision: 13,
    scale: 2,
  }).notNull(),
  vendorCode: text("vendor_code"),
  effectiveDateFrom: timestamptz("effective_date_from").notNull(),
  effectiveDateTo: timestamptz("effective_date_to").notNull(),
  isActive: boolean("is_active").notNull(),
});

/**
 * Identity includes deduction_id so two SELL_OUT deductions of the same type
 * keep separate rows for the same product and day. Pre-deduction seed rows use
 * deduction_id 0.
 */
export const expenseEvents = vendorSchema.table(
  "expense_events",
  {
    storeId: bigint("store_id", { mode: "bigint" }).notNull(),
    sourceSystemId: text("source_system_id").notNull(),
    productSku: text("product_sku"),
    expenseDate: timestamptz("expense_date").notNull(),
    vendorCode: text("vendor_code"),
    expenseType: text("expense_type").notNull(),
    expenseSubtype: text("expense_subtype").notNull(),
    cost: decimal("cost", { precision: 13, scale: 2 }).notNull(),
    expenseStatus: text("expense_status").notNull(),
    deductionId: bigint("deduction_id", { mode: "bigint" }).notNull(),
    createdAt: timestamptz("created_at").notNull(),
    updatedAt: timestamptz("updated_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [
        table.storeId,
        table.sourceSystemId,
        table.expenseDate,
        table.expenseType,
        table.expenseSubtype,
        table.deductionId,
      ],
    }),
  }),
);
