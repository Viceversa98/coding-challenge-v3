export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "PROCESSING_FAILED";

export class ApiError extends Error {
  readonly statusCode: number;
  readonly errorCode: ApiErrorCode;

  constructor(statusCode: number, errorCode: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}
