import request from "supertest";

import app from "../src/app";

jest.mock("../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("POST /api/vendors/deductions request parsing", () => {
  it("reports malformed JSON as invalid JSON", async () => {
    const response = await request(app)
      .post("/api/vendors/deductions")
      .set("Content-Type", "application/json")
      .send("{");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: "error",
      error: "INVALID_REQUEST",
      message: "Invalid JSON body",
    });
  });

  it("reports a missing store id", async () => {
    const response = await request(app)
      .post("/api/vendors/deductions")
      .send({ deductionId: "9" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: "error",
      error: "INVALID_REQUEST",
      message: "Invalid storeId",
    });
  });

  it("reports a non-numeric deduction id", async () => {
    const response = await request(app)
      .post("/api/vendors/deductions")
      .send({ storeId: "1", deductionId: "abc" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: "error",
      error: "INVALID_REQUEST",
      message: "Invalid deductionId",
    });
  });
});
