import { NextFunction, Request, Response } from "express";
import { ValidatedRequest, ValidationType } from "../types";

import { z } from "zod";

export type ValidateRequestOptions = {
  /** When set, Zod failures use the deduction error envelope instead of Validation Error. */
  invalidRequestMessage?: (error: z.ZodError) => string;
};

export const validateRequest = <T extends z.ZodTypeAny>(
  schema: T,
  validationType: ValidationType = "body",
  options?: ValidateRequestOptions,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[validationType];
      const validatedData = schema.parse(dataToValidate) as z.infer<T>;

      // Attach validated data to request for type safety
      (req as ValidatedRequest<T>).validatedData = validatedData;

      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        if (options?.invalidRequestMessage) {
          return res.status(400).json({
            status: "error",
            error: "INVALID_REQUEST",
            message: options.invalidRequestMessage(error),
          });
        }

        const formattedErrors = error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));

        return res.status(400).json({
          error: "Validation Error",
          details: formattedErrors,
        });
      }

      next(error);
    }
  };
};
