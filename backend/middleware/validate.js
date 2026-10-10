import { AppError } from '../lib/errors.js'

/** Validates `req.body` against a zod schema and replaces it with the parsed value. */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {})
    if (!result.success) {
      const first = result.error.issues[0]
      const field = first?.path?.join('.')
      const message = field ? `${field}: ${first.message}` : first?.message || 'Invalid request'
      return next(new AppError(400, message, 'VALIDATION_ERROR', result.error.issues))
    }
    req.body = result.data
    next()
  }
}
