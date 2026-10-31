import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { errorResponseSchema } from '../../shared/error-response.js'
import { mapPage } from '../../shared/pagination.js'
import { BrokersRepository } from '../brokers/brokers.repository.js'
import { PropertiesRepository } from '../properties/properties.repository.js'
import { BookingsRepository } from './bookings.repository.js'
import {
  bookingIdParamsSchema,
  bookingPageSchema,
  bookingSchema,
  calendarQuerySchema,
  createBookingBodySchema,
  financialsSchema,
  listBookingsQuerySchema,
  quoteBodySchema,
  toPublicBooking,
  updateBookingBodySchema,
} from './bookings.schemas.js'
import { BookingsService } from './bookings.service.js'

const tags = ['bookings']
const security = [{ bearerAuth: [] }]
const errors = { 400: errorResponseSchema, 401: errorResponseSchema }

export const bookingsRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new BookingsService({
    bookings: new BookingsRepository(app.db),
    properties: new PropertiesRepository(app.db),
    brokers: new BrokersRepository(app.db),
  })

  app.addHook('onRequest', app.authenticate)

  app.get(
    '/',
    {
      schema: {
        tags,
        security,
        summary: 'List my bookings',
        description:
          '`upcoming` (default): check-out today or later, soonest first. `past`: check-out ' +
          'before today, latest first. "Today" is in America/Sao_Paulo.',
        querystring: listBookingsQuerySchema,
        response: { 200: bookingPageSchema, ...errors },
      },
    },
    async (request) =>
      mapPage(await service.list(request.user.sub, request.query), toPublicBooking),
  )

  app.get(
    '/calendar',
    {
      schema: {
        tags,
        security,
        summary: 'Bookings in a date window, for a calendar',
        description:
          'Every booking with at least one night in [from, to), across all my properties or ' +
          'one of them. Not paginated; the window can span up to 366 days.',
        querystring: calendarQuerySchema,
        response: { 200: z.array(bookingSchema), ...errors },
      },
    },
    async (request) =>
      (await service.calendar(request.user.sub, request.query)).map(toPublicBooking),
  )

  app.post(
    '/quote',
    {
      schema: {
        tags,
        security,
        summary: 'Work out the money of a booking without saving it',
        description:
          'For the booking form to show totals as the user types. Same rules and 400 codes ' +
          'as creating a booking: INVALID_DATES (order or more than 365 nights), ' +
          'DISCOUNT_EXCEEDS_LODGING, PAYMENT_EXCEEDS_TOTAL and COMMISSION_WITHOUT_BROKER ' +
          '(send the chosen brokerId; it is not looked up). Amounts in cents, commission in ' +
          'basis points.',
        body: quoteBodySchema,
        response: { 200: financialsSchema, ...errors },
      },
    },
    (request) => service.quote(request.body),
  )

  app.get(
    '/:id',
    {
      schema: {
        tags,
        security,
        summary: 'Get one of my bookings',
        params: bookingIdParamsSchema,
        response: { 200: bookingSchema, ...errors, 404: errorResponseSchema },
      },
    },
    async (request) => toPublicBooking(await service.get(request.user.sub, request.params.id)),
  )

  const writeDescription =
    'Amounts in cents, commission in basis points (1000 = 10%). 400 codes: INVALID_DATES, ' +
    'COMMISSION_WITHOUT_BROKER. 404 codes: PROPERTY_NOT_FOUND, BROKER_NOT_FOUND. 409 ' +
    'BOOKING_OVERLAP when the property is already booked on one of the nights; ' +
    '`details` names the booking in the way. The check-out day is free for a check-in.'

  app.post(
    '/',
    {
      schema: {
        tags,
        security,
        summary: 'Book a property',
        description: writeDescription,
        body: createBookingBodySchema,
        response: {
          201: bookingSchema,
          ...errors,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const booking = await service.create(request.user.sub, request.body)
      return reply.status(201).send(toPublicBooking(booking))
    },
  )

  app.patch(
    '/:id',
    {
      schema: {
        tags,
        security,
        summary: 'Change a booking',
        description: `Send only what changes. ${writeDescription} Removing the broker also drops the commission unless one is sent.`,
        params: bookingIdParamsSchema,
        body: updateBookingBodySchema,
        response: {
          200: bookingSchema,
          ...errors,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request) =>
      toPublicBooking(await service.update(request.user.sub, request.params.id, request.body)),
  )

  app.delete(
    '/:id',
    {
      schema: {
        tags,
        security,
        summary: 'Delete a booking',
        params: bookingIdParamsSchema,
        response: { 204: z.null(), ...errors, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await service.delete(request.user.sub, request.params.id)
      return reply.status(204).send(null)
    },
  )
}
