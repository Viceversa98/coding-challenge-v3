export type HealthResponse = {
  status: "ok" | "error";
  timestamp: string;
  database: "connected" | "disconnected";
};

export type DeductionSuccess = {
  status: "success";
  message: string;
  expenseEventsRemoved: number;
  expenseEventsCreated: number;
  expenseEventsUpdated: number;
};

export type ApiErrorBody = {
  status: "error";
  error: string;
  message: string;
};

export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;

  constructor(statusCode: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
    this.errorCode = body.error;
  }
}

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (text === "") {
    return null;
  }

  return JSON.parse(text) as unknown;
};

const isApiErrorBody = (value: unknown): value is ApiErrorBody => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const body = value as Partial<ApiErrorBody>;
  return (
    body.status === "error" &&
    typeof body.error === "string" &&
    typeof body.message === "string"
  );
};

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

export const fetchStores = async (): Promise<CatalogStore[]> => {
  const response = await fetch("/api/vendors/stores");
  const body = (await readJson(response)) as { stores?: CatalogStore[] } | null;

  if (!response.ok || !body || !Array.isArray(body.stores)) {
    throw new Error("Could not load stores");
  }

  return body.stores;
};

export const fetchHealth = async (): Promise<HealthResponse> => {
  const response = await fetch("/api/health");
  const body = (await readJson(response)) as HealthResponse | null;

  if (
    (response.status === 200 || response.status === 503) &&
    body &&
    typeof body.database === "string" &&
    typeof body.timestamp === "string"
  ) {
    return body;
  }

  throw new Error("Health check failed");
};

export const processDeduction = async (input: {
  storeId: string;
  deductionId: string;
}): Promise<DeductionSuccess> => {
  const response = await fetch("/api/vendors/deductions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const body = await readJson(response);

  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiRequestError(response.status, body);
    }

    throw new ApiRequestError(response.status, {
      status: "error",
      error: "PROCESSING_FAILED",
      message: "Failed to process deduction",
    });
  }

  return body as DeductionSuccess;
};
