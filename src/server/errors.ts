/** خطاهای دامنه با کد پایدار تا لایه UI بتواند پیام مناسب نشان دهد. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super("VALIDATION_ERROR", message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super("FORBIDDEN", message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super("NOT_FOUND", `${entity} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 409);
  }
}

/** نقض قوانین کسب‌وکار (ساعات کاری، تعطیلی، انتقال وضعیت نامعتبر و …) */
export class BusinessRuleError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 422);
  }
}

interface PgErrorLike {
  code?: string;
  constraint?: string;
  cause?: unknown;
}

/**
 * خطای PostgreSQL را (حتی اگر Drizzle آن را wrap کرده باشد) پیدا می‌کند.
 */
export function findPgError(err: unknown): { code: string; constraint?: string } | null {
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth++) {
    const e = current as PgErrorLike;
    if (typeof e.code === "string" && /^[0-9A-Z]{5}$/.test(e.code)) {
      return { code: e.code, constraint: e.constraint };
    }
    current = e.cause;
  }
  return null;
}

export const PG = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  CHECK_VIOLATION: "23514",
  EXCLUSION_VIOLATION: "23P01",
} as const;
