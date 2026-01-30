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
