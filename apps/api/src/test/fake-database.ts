import { vi } from 'vitest'

import type { Database } from '../shared/database.js'

export interface FakeDatabase {
  $queryRaw: ReturnType<typeof vi.fn>
  $disconnect: ReturnType<typeof vi.fn>
}

/** A stand-in for the Prisma client, for tests that don't need a real database. */
export function fakeDatabase(): FakeDatabase & Database {
  const fake: FakeDatabase = {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  }
  return fake as unknown as FakeDatabase & Database
}
