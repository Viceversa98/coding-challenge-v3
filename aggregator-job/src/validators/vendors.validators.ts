import { ValidatedRequest } from "../types";
import { z } from "zod";

const POSTGRES_BIGINT_MAX = 9223372036854775807n;

const numericId = (field: "storeId" | "deductionId") =>
  z
    .string({
      required_error: `Invalid ${field}`,
      invalid_type_error: `Invalid ${field}`,
    })
    .regex(/^\d+$/, `Invalid ${field}`)
    .refine((value) => {
      try {
        return BigInt(value) <= POSTGRES_BIGINT_MAX;
      } catch {
        return false;
      }
    }, `Invalid ${field}`);

export const deductionsQuerySchema = z.object({
  storeId: numericId("storeId"),
  deductionId: numericId("deductionId"),
});

export type DeductionsQuery = z.infer<typeof deductionsQuerySchema>;

/** Request type for routes that use validateRequest(deductionsQuerySchema, ...) */
export type DeductionsValidatedRequest = ValidatedRequest<
  typeof deductionsQuerySchema
>;

export const deductionValidationMessage = (error: z.ZodError): string => {
  const storeIssue = error.errors.find((issue) => issue.path[0] === "storeId");
  if (storeIssue) {
    return "Invalid storeId";
  }

  const deductionIssue = error.errors.find(
    (issue) => issue.path[0] === "deductionId",
  );
  if (deductionIssue) {
    return "Invalid deductionId";
  }

  return "Invalid storeId";
};
