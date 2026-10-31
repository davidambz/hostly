import type { FastifyError, FastifyPluginAsync, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

import type { ErrorResponse, ValidationIssue } from '../shared/error-response.js'
import { AppError } from '../shared/errors.js'

function send(reply: FastifyReply, body: ErrorResponse) {
  return reply.status(body.statusCode).send(body)
}

const errorHandler: FastifyPluginAsync = async (app) => {
  app.setErrorHandler<FastifyError | AppError>((error, request, reply) => {
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
    const statusCode = error.statusCode ?? 500
    if (statusCode >= 400 && statusCode < 500) {
      return send(reply, {
        statusCode,
        code: error.code,
        message: error.message,
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
