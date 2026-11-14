import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import { formatDate } from '../../shared/dates.js'
import { errorResponseSchema } from '../../shared/error-response.js'
import { ReportsRepository } from './reports.repository.js'
import {
  brokersQuerySchema,
  brokersReportSchema,
  monthlyQuerySchema,
  monthlySchema,
  performanceSchema,
  periodQuerySchema,
} from './reports.schemas.js'
import { ReportsService } from './reports.service.js'

const tags = ['reports']
const security = [{ bearerAuth: [] }]
const errors = { 400: errorResponseSchema, 401: errorResponseSchema }

/** Reports on the user's properties, for any plan. */
export const reportsRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new ReportsService(new ReportsRepository(app.db))

  app.addHook('onRequest', app.authenticate)

  app.get(
    '/performance',
    {
      schema: {
        tags,
        security,
        summary: 'How each property did in a period',
        description:
          'From `from` to the day before `to` (at most 731 days). Every property, zeros ' +
          'included, and the total. A booking crossing the edges counts only its nights ' +
          'inside, with its lodging and broker fee spread per night; the cleaning fee counts ' +
          'on the check-in day. Money in cents.',
        querystring: periodQuerySchema,
        response: { 200: performanceSchema, ...errors },
      },
    },
    async (request) => ({
      ...request.query,
      ...(await service.performance(request.user.sub, request.query.from, request.query.to)),
    }),
  )

  app.get(
    '/monthly',
    {
      schema: {
        tags,
        security,
        summary: 'Each month of a year',
        description:
          'The figures of every month of `year` and of the whole year, for `propertyId` or ' +
          'all properties (404 PROPERTY_NOT_FOUND for one that is not yours). Same rules as ' +
          '/reports/performance.',
        querystring: monthlyQuerySchema,
        response: { 200: monthlySchema, 404: errorResponseSchema, ...errors },
      },
    },
    async (request) =>
      service.monthly(request.user.sub, request.query.year, request.query.propertyId),
  )

  app.get(
    '/brokers',
    {
      schema: {
        tags,
        security,
        summary: 'Commissions per broker, and each channel',
        description:
          'What to pay each broker: the bookings checking in during the period, each with ' +
          'its whole fee, listed. Channels (each broker and direct bookings) follow the ' +
          'performance rules instead: nights inside the period, spread per night. Optionally ' +
          'for one property (404 PROPERTY_NOT_FOUND when not yours).',
        querystring: brokersQuerySchema,
        response: { 200: brokersReportSchema, 404: errorResponseSchema, ...errors },
      },
    },
    async (request) => {
      const { from, to, propertyId } = request.query
      const report = await service.brokers(request.user.sub, from, to, propertyId)
      return {
        from,
        to,
        channels: report.channels,
        brokers: report.brokers.map((broker) => ({
          ...broker,
          items: broker.items.map((item) => ({
            ...item,
            checkIn: formatDate(item.checkIn),
            checkOut: formatDate(item.checkOut),
          })),
        })),
      }
    },
  )
}
