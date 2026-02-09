export class CustomError extends Error {
  statusCode: number;
  key: string | null = null;

  constructor(message: string, statusCode: number = 500, key: string | null = null) {
    super(message);
    this.statusCode = statusCode;
    this.key = key;
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}

export class ValidationError extends CustomError {
  constructor(message: string, key: string | null = null) {
    super(message, 400, key);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string, key: string | null = null) {
    super(message, 404, key);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class UnauthorizedError extends CustomError {
  constructor(message: string = 'Unauthorized', key: string | null = null) {
    super(message, 401, key);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends CustomError {
  constructor(message: string = 'Forbidden', key: string | null = null) {
    super(message, 403, key);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class ConflictError extends CustomError {
  constructor(message: string = 'Resource already exists', key: string | null = null) {
    super(message, 409, key);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class RateLimitError extends CustomError {
  retryAfter: number | null;

  constructor(message: string = 'Rate limit exceeded', retryAfter: number | null = null, key: string | null = null) {
    super(message, 429, key);
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class ServiceUnavailableError extends CustomError {
  constructor(message: string = 'Service temporarily unavailable', key: string | null = null) {
    super(message, 503, key);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

export class BadGatewayError extends CustomError {
  constructor(message: string = 'Bad gateway', key: string | null = null) {
    super(message, 502, key);
    Object.setPrototypeOf(this, BadGatewayError.prototype);
  }
}

export class GatewayTimeoutError extends CustomError {
  constructor(message: string = 'Gateway timeout', key: string | null = null) {
    super(message, 504, key);
    Object.setPrototypeOf(this, GatewayTimeoutError.prototype);
  }
}
