import { NextFunction, Request, Response } from "express";

import { env } from "../config/env";
import { ApiError } from "../errors/apiError";
import { logger } from "../utils/logger";

const statusCodeFromError = (err: Error): number => {
  if (
    "statusCode" in err &&
    typeof (err as { statusCode?: unknown }).statusCode === "number"
  ) {
    return (err as { statusCode: number }).statusCode;
  }

  if (
    "status" in err &&
    typeof (err as { status?: unknown }).status === "number"
  ) {
    return (err as { status: number }).status;
  }

  return 500;
};

const isDeductionRequest = (req: Request): boolean => {
  const path = (req.originalUrl ?? "").split("?")[0];
  return req.method === "POST" && path === "/api/vendors/deductions";
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  void _next;

  logger.error("Error occurred:", {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query,
  });

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      status: "error",
      error: err.errorCode,
      message: err.message,
    });
    return;
  }

  if (isDeductionRequest(req)) {
    const isJsonParseError = err instanceof SyntaxError && "body" in err;
    res.status(isJsonParseError ? 400 : statusCodeFromError(err)).json({
      status: "error",
      error: isJsonParseError ? "INVALID_REQUEST" : "PROCESSING_FAILED",
      message: isJsonParseError
        ? "Invalid JSON body"
        : `Failed to process deduction: ${err.message}`,
    });
    return;
  }

  const statusCode = statusCodeFromError(err);
  const isProduction = env.NODE_ENV === "production";

  res.status(statusCode).json({
    error: err.message || "Internal Server Error",
    ...(isProduction ? {} : { stack: err.stack }),
  });
};
