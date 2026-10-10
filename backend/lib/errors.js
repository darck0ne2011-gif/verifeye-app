/**
 * Error that is safe to show to API clients. Anything else is logged and
 * returned as a generic 500.
 */
export class AppError extends Error {
  constructor(status, message, code = undefined, details = undefined) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export const badRequest = (message, code) => new AppError(400, message, code)
export const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') =>
  new AppError(401, message, code)
export const paymentRequired = (message, code = 'INSUFFICIENT_CREDITS') => new AppError(402, message, code)
export const forbidden = (message = 'Forbidden', code = 'FORBIDDEN') => new AppError(403, message, code)
export const notFound = (message = 'Not found', code = 'NOT_FOUND') => new AppError(404, message, code)
export const serviceUnavailable = (message, code) => new AppError(503, message, code)
