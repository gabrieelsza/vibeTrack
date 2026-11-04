export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    statusCode = 400,
    code = 'BAD_REQUEST',
    retryAfterSeconds?: number
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ServiceBusyError extends AppError {
  constructor(
    retryAfterSeconds = 5,
    message = 'A banda está ocupada. Tente de novo em alguns segundos'
  ) {
    super(message, 503, 'BUSY', Math.max(1, Math.ceil(retryAfterSeconds)));
    Object.setPrototypeOf(this, ServiceBusyError.prototype);
  }
}
