const errorEnvelope = (
  errorCode: "INVALID_REQUEST" | "NOT_FOUND" | "PROCESSING_FAILED",
) => ({
  type: "object",
  required: ["status", "error", "message"],
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["error"] },
    error: { type: "string", enum: [errorCode] },
    message: { type: "string" },
  },
});

const healthEnvelope = (
  status: "ok" | "error",
  database: "connected" | "disconnected",
) => ({
  type: "object",
  required: ["status", "timestamp", "database"],
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: [status] },
    timestamp: {
      type: "string",
      format: "date-time",
      description: "Current UTC time in ISO 8601.",
    },
    database: { type: "string", enum: [database] },
  },
});

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Process Deduction API",
    version: "1.0.0",
    description: [
      "GET /api/health reports whether this process can reach the database.",
      "POST /api/vendors/deductions replaces one deduction's SELL_OUT expense events from product sales in the deduction's effective date range.",
      "Only NET_RECEIPTS deductions are processed. Any other basis, including FIXED_AMOUNT, removes that deduction's existing SELL_OUT events and then returns 400 INVALID_REQUEST.",
      "Only SELL_OUT expense events are created or updated. SELL_IN is never read or written.",
      "Inactive deductions delete existing SELL_OUT events for that deduction and create none.",
      "The effective date range is inclusive on both effectiveDateFrom and effectiveDateTo.",
      "Repeating the same request is idempotent and safe to retry. A failure rolls back the transaction.",
      "cost = shipped_revenue × deduction_value. deduction_value is a rate, not a percent (do not divide by 100).",
      'Success message is exactly "Deductions processed succesfully".',
    ].join(" "),
  },
  tags: [
    {
      name: "Health",
      description: "Process and database connectivity.",
    },
    {
      name: "Vendors",
      description: "Vendor deduction processing.",
    },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Check API and database connectivity",
        description:
          "Calls sequelize.authenticate(). Returns 200 when the database accepts the connection and 503 when that check throws. No query, path, or body parameters.",
        operationId: "healthCheck",
        responses: {
          "200": {
            description: "Database connection succeeded.",
            content: {
              "application/json": {
                schema: healthEnvelope("ok", "connected"),
                example: {
                  status: "ok",
                  timestamp: "2026-09-26T05:40:00.000Z",
                  database: "connected",
                },
              },
            },
          },
          "503": {
            description:
              "Database connection failed. The handler still returns the current timestamp.",
            content: {
              "application/json": {
                schema: healthEnvelope("error", "disconnected"),
                example: {
                  status: "error",
                  timestamp: "2026-09-26T05:40:00.000Z",
                  database: "disconnected",
                },
              },
            },
          },
        },
      },
    },
    "/api/vendors/stores": {
      get: {
        tags: ["Vendors"],
        summary: "List existing stores and their deductions",
        description:
          "Read-only catalog of store IDs already in the database, with each store's deductions. Does not create stores or deductions.",
        operationId: "listStores",
        responses: {
          "200": {
            description: "Stores and deductions currently stored.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["stores"],
                  additionalProperties: false,
                  properties: {
                    stores: {
                      type: "array",
                      items: {
                        type: "object",
                        required: [
                          "storeId",
                          "marketplaceType",
                          "marketplaceSubtype",
                          "marketplaceCountry",
                          "sourceSystemId",
                          "deductions",
                        ],
                        properties: {
                          storeId: { type: "string", example: "1" },
                          marketplaceType: { type: "string" },
                          marketplaceSubtype: { type: "string" },
                          marketplaceCountry: { type: "string" },
                          sourceSystemId: { type: "string" },
                          deductions: {
                            type: "array",
                            items: {
                              type: "object",
                              required: [
                                "deductionId",
                                "deductionType",
                                "deductionBasis",
                                "deductionValue",
                                "isActive",
                              ],
                              properties: {
                                deductionId: { type: "string", example: "1" },
                                deductionType: { type: "string" },
                                deductionBasis: {
                                  type: "string",
                                  enum: ["FIXED_AMOUNT", "NET_RECEIPTS"],
                                },
                                deductionValue: { type: "string" },
                                isActive: { type: "boolean" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/vendors/deductions": {
      post: {
        tags: ["Vendors"],
        summary: "Process a vendor deduction",
        description:
          "NET_RECEIPTS only. SELL_OUT expense events only, keyed by deduction id so two deductions of the same type do not overwrite each other. Inactive deductions delete existing events and create none. A deduction id that belongs to another store returns 400. An unsupported basis deletes that deduction's SELL_OUT events, then returns 400. Inclusive effective date range. Idempotent retries. cost = shipped_revenue × deduction_value, where deduction_value is a rate, not a percent.",
        operationId: "processDeduction",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["storeId", "deductionId"],
                additionalProperties: false,
                properties: {
                  storeId: {
                    type: "string",
                    description: "Store identifier.",
                    example: "store123",
                  },
                  deductionId: {
                    type: "string",
                    description: "Deduction identifier to process.",
                    example: "deduction456",
                  },
                },
              },
              example: {
                storeId: "store123",
                deductionId: "deduction456",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Deduction processed.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: [
                    "status",
                    "message",
                    "expenseEventsRemoved",
                    "expenseEventsCreated",
                    "expenseEventsUpdated",
                  ],
                  additionalProperties: false,
                  properties: {
                    status: { type: "string", enum: ["success"] },
                    message: {
                      type: "string",
                      enum: ["Deductions processed succesfully"],
                    },
                    expenseEventsRemoved: {
                      type: "integer",
                      description: "Rows deleted.",
                      minimum: 0,
                    },
                    expenseEventsCreated: {
                      type: "integer",
                      description: "Rows inserted.",
                      minimum: 0,
                    },
                    expenseEventsUpdated: {
                      type: "integer",
                      description: "Rows whose cost was refreshed.",
                      minimum: 0,
                    },
                  },
                },
                examples: {
                  activeNetReceipts: {
                    summary:
                      "Scenario 1: 500 sales, cost = shipped_revenue × 0.10",
                    value: {
                      status: "success",
                      message: "Deductions processed succesfully",
                      expenseEventsRemoved: 0,
                      expenseEventsCreated: 500,
                      expenseEventsUpdated: 0,
                    },
                  },
                  inactiveDeduction: {
                    summary:
                      "Scenario 2: inactive deduction removes existing events and creates none",
                    value: {
                      status: "success",
                      message: "Deductions processed succesfully",
                      expenseEventsRemoved: 200,
                      expenseEventsCreated: 0,
                      expenseEventsUpdated: 0,
                    },
                  },
                },
              },
            },
          },
          "400": {
            description:
              "INVALID_REQUEST: missing or non-numeric ids, a deduction that belongs to another store, malformed JSON, or basis is not NET_RECEIPTS. An unsupported basis deletes that deduction's existing SELL_OUT events before the 400 response.",
            content: {
              "application/json": {
                schema: errorEnvelope("INVALID_REQUEST"),
                examples: {
                  invalidStoreId: {
                    summary: "Non-numeric or missing store id",
                    value: {
                      status: "error",
                      error: "INVALID_REQUEST",
                      message: "Invalid storeId",
                    },
                  },
                  invalidDeductionId: {
                    summary: "Non-numeric or missing deduction id",
                    value: {
                      status: "error",
                      error: "INVALID_REQUEST",
                      message: "Invalid deductionId",
                    },
                  },
                  basisNotNetReceipts: {
                    summary:
                      "Basis is not NET_RECEIPTS. Existing SELL_OUT rows for this deduction were removed.",
                    value: {
                      status: "error",
                      error: "INVALID_REQUEST",
                      message: "Deduction basis must be NET_RECEIPTS",
                    },
                  },
                  deductionWrongStore: {
                    summary: "Deduction exists on a different store",
                    value: {
                      status: "error",
                      error: "INVALID_REQUEST",
                      message: "Deduction does not belong to this store",
                    },
                  },
                  invalidJson: {
                    summary: "Request body is not valid JSON",
                    value: {
                      status: "error",
                      error: "INVALID_REQUEST",
                      message: "Invalid JSON body",
                    },
                  },
                },
              },
            },
          },
          "404": {
            description:
              "NOT_FOUND: the store id or the deduction id does not exist.",
            content: {
              "application/json": {
                schema: errorEnvelope("NOT_FOUND"),
                examples: {
                  storeNotFound: {
                    summary: "Missing store",
                    value: {
                      status: "error",
                      error: "NOT_FOUND",
                      message: "Store not found",
                    },
                  },
                  deductionNotFound: {
                    summary: "No deduction with this id",
                    value: {
                      status: "error",
                      error: "NOT_FOUND",
                      message: "Deduction not found",
                    },
                  },
                },
              },
            },
          },
          "500": {
            description:
              "PROCESSING_FAILED after the transaction is rolled back.",
            content: {
              "application/json": {
                schema: errorEnvelope("PROCESSING_FAILED"),
                example: {
                  status: "error",
                  error: "PROCESSING_FAILED",
                  message: "Failed to process deduction: <details>",
                },
              },
            },
          },
        },
      },
    },
  },
};
