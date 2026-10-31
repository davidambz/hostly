import { STATUS_CODES } from 'node:http'

import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

import type { ErrorResponse, ValidationIssue } from '../shared/error-response.js'
import { AppError } from '../shared/errors.js'

interface HttpError {
  statusCode: number
  code?: unknown
  message?: unknown
}

function send(reply: FastifyReply, body: ErrorResponse) {
  return reply.status(body.statusCode).send(body)
}

function isClientError(error: unknown): error is HttpError {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) {
    return false
  }
  const { statusCode } = error
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
}

/** `404` → `NOT_FOUND`, used when a client error carries no code of its own. */
function codeFromStatus(statusCode: number) {
  return (STATUS_CODES[statusCode] ?? 'Client Error').toUpperCase().replace(/[^A-Z]+/g, '_')
}

const errorHandler: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return send(reply, {
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      })
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const location = error.validationContext ?? 'request'
      // The type provider only keeps the Zod path joined by "/", so keys containing
      // "/" or "." can't be told apart from nesting. None of our schemas use such keys.
      const details: ValidationIssue[] = error.validation.map((issue) => ({
        location,
        path: issue.instancePath.replace(/^\//, '').replaceAll('/', '.'),
        message: issue.message ?? 'Invalid value',
      }))
      return send(reply, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'The request is invalid',
        details,
      })
    }

    // Client errors raised by Fastify itself or its plugins (malformed JSON,
    // unsupported media type, payload too large, rate limit…) keep their status.
    if (isClientError(error)) {
      const { statusCode, code, message } = error
      return send(reply, {
        statusCode,
        code: typeof code === 'string' ? code : codeFromStatus(statusCode),
        message:
          typeof message === 'string' && message !== ''
            ? message
            : (STATUS_CODES[statusCode] ?? 'Client error'),
      })
    }

    request.log.error({ err: error }, 'unhandled error')
    return send(reply, {
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong',
    })
  })
}

export default fp(errorHandler, { name: 'error-handler' })
