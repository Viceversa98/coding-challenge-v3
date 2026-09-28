import {
  processDeduction,
  sellOutEventConflictTarget,
} from "../src/services/deduction.service";

const mockLimit = jest.fn();
const mockDeleteWhere = jest.fn();
const mockTransaction = jest.fn();

jest.mock("../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../src/config/drizzle", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockLimit(),
        }),
      }),
    }),
    delete: () => ({
      where: () => mockDeleteWhere(),
    }),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

type DeductionBasis = "FIXED_AMOUNT" | "NET_RECEIPTS";

const deductionRow = (
  storeId: bigint,
  basis: DeductionBasis = "NET_RECEIPTS",
) => ({
  deductionId: 9n,
  storeId,
  deductionType: "Marketing Fee",
  deductionBasis: basis,
  deductionValue: "0.10",
  vendorCode: "V1",
  effectiveDateFrom: "2026-01-01T00:00:00.000Z",
  effectiveDateTo: "2026-01-31T00:00:00.000Z",
  isActive: true,
});

describe("processDeduction", () => {
  beforeEach(() => {
    mockLimit.mockReset();
    mockDeleteWhere.mockReset();
    mockTransaction.mockReset();
  });

  it("keeps deduction id in the SELL_OUT conflict key", () => {
    expect(sellOutEventConflictTarget.map((column) => column.name)).toEqual([
      "store_id",
      "source_system_id",
      "expense_date",
      "expense_type",
      "expense_subtype",
      "deduction_id",
    ]);
  });

  it("returns store not found before looking up a deduction", async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(processDeduction("1", "9")).rejects.toMatchObject({
      statusCode: 404,
      errorCode: "NOT_FOUND",
      message: "Store not found",
    });
    expect(mockLimit).toHaveBeenCalledTimes(1);
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it("returns deduction not found when the id does not exist", async () => {
    mockLimit
      .mockResolvedValueOnce([{ storeId: 1n }])
      .mockResolvedValueOnce([]);

    await expect(processDeduction("1", "9")).rejects.toMatchObject({
      statusCode: 404,
      errorCode: "NOT_FOUND",
      message: "Deduction not found",
    });
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it("rejects a deduction that belongs to another store", async () => {
    mockLimit
      .mockResolvedValueOnce([{ storeId: 1n }])
      .mockResolvedValueOnce([deductionRow(2n)]);

    await expect(processDeduction("1", "9")).rejects.toMatchObject({
      statusCode: 400,
      errorCode: "INVALID_REQUEST",
      message: "Deduction does not belong to this store",
    });
    expect(mockDeleteWhere).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("removes existing SELL_OUT events when the basis is not NET_RECEIPTS", async () => {
    mockLimit
      .mockResolvedValueOnce([{ storeId: 1n }])
      .mockResolvedValueOnce([deductionRow(1n, "FIXED_AMOUNT")]);
    mockDeleteWhere.mockResolvedValueOnce({ rowCount: 4 });

    await expect(processDeduction("1", "9")).rejects.toMatchObject({
      statusCode: 400,
      errorCode: "INVALID_REQUEST",
      message: "Deduction basis must be NET_RECEIPTS",
    });
    expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
