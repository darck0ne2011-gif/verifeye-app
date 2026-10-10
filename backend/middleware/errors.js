import multer from 'multer'
import { AppError } from '../lib/errors.js'
import { config } from '../config.js'

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' })
}

export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, error: err.message, code: err.code })
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message
    return res.status(400).json({ success: false, error: message, code: err.code })
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON body', code: 'INVALID_JSON' })
  }

  console.error(`[${req.method} ${req.originalUrl}]`, err)
  res.status(500).json({
    success: false,
    error: config.isProduction ? 'Internal server error' : err?.message || 'Internal server error',
    code: 'INTERNAL_ERROR',
  })
}
