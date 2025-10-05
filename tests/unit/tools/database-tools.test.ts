import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerDatabaseTools } from '../../../src/tools/database-tools'
import type {
  CreateReservationInput,
  DeleteReservationInput,
  UpdateReservationInput,
} from '../../../src/types'

type RegisteredTool = {
  description: string
  handler: (input: unknown) => Promise<any>
}

class TestServer {
  public tools = new Map<string, RegisteredTool>()

  tool(name: string, description: string, _schema: unknown, handler: RegisteredTool['handler']) {
    this.tools.set(name, { description, handler })
  }
}

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
}

describe('registerDatabaseTools', () => {
  let server: TestServer

  beforeEach(() => {
    server = new TestServer()
    vi.restoreAllMocks()
    global.fetch = vi.fn()
  })

  function getHandler(name: string) {
    const tool = server.tools.get(name)
    if (!tool) throw new Error(`Tool ${name} not registered`)
    return tool.handler
  }

  it('registers the reservation tools', () => {
    registerDatabaseTools(server as any, env as any)

    expect(Array.from(server.tools.keys())).toEqual([
      'createReservation',
      'updateReservation',
      'deleteReservation',
    ])
  })

  it('creates reservations successfully', async () => {
    registerDatabaseTools(server as any, env as any)

    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(
        JSON.stringify([
          {
            id: 1,
            name: 'Ada Lovelace',
            mobile: '+1234567890',
            nb_people: 4,
            date: '2025-05-01',
            time: '19:00',
          },
        ]),
      ),
    }

    vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response)

    const handler = getHandler('createReservation')
    const payload: CreateReservationInput = {
      mobile: '+1234567890',
      name: 'Ada Lovelace',
      nb_people: 4,
      date: '2025-05-01',
      time: '19:00',
    }

    const result = await handler(payload)

    expect(result.content[0].isError).toBeFalsy()
    expect(result.content[0].text).toContain('Created reservation for Ada Lovelace')
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1)

    const [url, init] = vi.mocked(global.fetch).mock.calls[0]
    expect(url.toString()).toBe('https://example.supabase.co/rest/v1/reservations')
    expect(init).toMatchObject({ method: 'POST' })
  })

  it('returns detailed errors when updates fail', async () => {
    registerDatabaseTools(server as any, env as any)

    const mockResponse = {
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({ message: 'duplicate key value violates unique constraint' })
      ),
    }

    vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response)

    const handler = getHandler('updateReservation')
    const payload: UpdateReservationInput = {
      mobile: '+1234567890',
      name: 'Ada Lovelace',
      nb_people: 6,
    }

    const result = await handler(payload)

    expect(result.content[0].isError).toBe(true)
    expect(result.content[0].text).toContain('Failed to update the reservation')
    expect(result.content[0].text).toContain('duplicate key value')
  })

  it('reports when no reservation is deleted', async () => {
    registerDatabaseTools(server as any, env as any)

    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify([])),
    }

    vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response)

    const handler = getHandler('deleteReservation')
    const payload: DeleteReservationInput = {
      mobile: '+1234567890',
      name: 'Ada Lovelace',
    }

    const result = await handler(payload)

    expect(result.content[0].isError).toBe(true)
    expect(result.content[0].text).toContain('No reservation for Ada Lovelace')
  })
})
