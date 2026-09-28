import { asc } from "drizzle-orm";

import { db } from "../config/drizzle";
import { deductions, stores } from "../db/schema";

export type CatalogDeduction = {
  deductionId: string;
  deductionType: string;
  deductionBasis: "FIXED_AMOUNT" | "NET_RECEIPTS";
  deductionValue: string;
  isActive: boolean;
};

export type CatalogStore = {
  storeId: string;
  marketplaceType: string;
  marketplaceSubtype: string;
  marketplaceCountry: string;
  sourceSystemId: string;
  deductions: CatalogDeduction[];
};

export const listStores = async (): Promise<CatalogStore[]> => {
  const storeRows = await db
    .select({
      storeId: stores.storeId,
      marketplaceType: stores.marketplaceType,
      marketplaceSubtype: stores.marketplaceSubtype,
      marketplaceCountry: stores.marketplaceCountry,
      sourceSystemId: stores.sourceSystemId,
    })
    .from(stores)
    .orderBy(asc(stores.storeId));

  const deductionRows = await db
    .select({
      deductionId: deductions.deductionId,
      storeId: deductions.storeId,
      deductionType: deductions.deductionType,
      deductionBasis: deductions.deductionBasis,
      deductionValue: deductions.deductionValue,
      isActive: deductions.isActive,
    })
    .from(deductions)
    .orderBy(asc(deductions.deductionId));

  const deductionsByStore = new Map<string, CatalogDeduction[]>();
  for (const row of deductionRows) {
    const storeId = row.storeId.toString();
    const existing = deductionsByStore.get(storeId) ?? [];
    existing.push({
      deductionId: row.deductionId.toString(),
      deductionType: row.deductionType,
      deductionBasis: row.deductionBasis,
      deductionValue: row.deductionValue,
      isActive: row.isActive,
    });
    deductionsByStore.set(storeId, existing);
  }

  return storeRows.map((store) => {
    const storeId = store.storeId.toString();
    return {
      storeId,
      marketplaceType: store.marketplaceType,
      marketplaceSubtype: store.marketplaceSubtype,
      marketplaceCountry: store.marketplaceCountry,
      sourceSystemId: store.sourceSystemId,
      deductions: deductionsByStore.get(storeId) ?? [],
    };
  });
};
