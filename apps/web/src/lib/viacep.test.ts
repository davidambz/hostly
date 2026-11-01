import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/test/server'

import { lookupCep, VIACEP_URL } from './viacep'

describe('lookupCep', () => {
  it('maps the address of an existing CEP', async () => {
    server.use(
      http.get(`${VIACEP_URL}/88053700/json/`, () =>
        HttpResponse.json({
          uf: 'SC',
          localidade: 'Florianópolis',
          bairro: 'Jurerê',
          logradouro: 'Avenida dos Búzios',
        }),
      ),
    )

    await expect(lookupCep('88053-700')).resolves.toEqual({
      state: 'SC',
      city: 'Florianópolis',
      neighborhood: 'Jurerê',
      street: 'Avenida dos Búzios',
    })
  })

  it('fills missing parts with empty strings (CEPs of a whole city)', async () => {
    server.use(
      http.get(`${VIACEP_URL}/88330000/json/`, () =>
        HttpResponse.json({ uf: 'SC', localidade: 'Balneário Camboriú' }),
      ),
    )

    await expect(lookupCep('88330000')).resolves.toMatchObject({ neighborhood: '', street: '' })
  })

  it.each([
    ['ViaCEP says it does not exist', () => HttpResponse.json({ erro: 'true' })],
    ['ViaCEP rejects it as malformed', () => new HttpResponse(null, { status: 400 })],
  ])('resolves null when %s', async (_case, reply) => {
    server.use(http.get(`${VIACEP_URL}/99999999/json/`, reply))

    await expect(lookupCep('99999-999')).resolves.toBeNull()
  })

  it('does not even ask for an incomplete CEP', async () => {
    await expect(lookupCep('8805')).resolves.toBeNull()
  })

  it('rejects when ViaCEP is down, so the form can say so', async () => {
    server.use(
      http.get(`${VIACEP_URL}/88053700/json/`, () => new HttpResponse(null, { status: 503 })),
    )

    await expect(lookupCep('88053700')).rejects.toThrow('503')
  })
})
