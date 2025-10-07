import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerDatabaseTools } from '../../../src/tools/database-tools'
import type {
  CreateReservationInput,
  DeleteReservationInput,
  GetReservationInput,
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
      'getReservation',
      'updateReservation',
      'deleteReservation',
    ])
  })

  it('retrieves reservations successfully', async () => {
    registerDatabaseTools(server as any, env as any)

    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(
        JSON.stringify([
          {
            id: 42,
            name: 'Ada Lovelace',
            mobile: '+1234567890',
            date: '2025-05-01',
            time: '19:00',
            nb_people: 4,
          },
        ])
      ),
    }

    vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response)

    const handler = getHandler('getReservation')
    const payload: GetReservationInput = {
      mobile: '+1234567890',
      name: 'Ada Lovelace',
      date: '2025-05-01',
    }

    const result = await handler(payload)

    expect(result.content[0].isError).toBeFalsy()
    expect(result.content[0].text).toContain('Found reservation for Ada Lovelace')

    const [url, init] = vi.mocked(global.fetch).mock.calls[0]
    expect(url.toString()).toContain('select=*')
    expect(url.toString()).toContain('date=eq.2025-05-01')
    expect(init).toMatchObject({ method: 'GET' })
  })

  it('returns errors when reservation lookup fails', async () => {
    registerDatabaseTools(server as any, env as any)

    const mockResponse = {
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({ message: 'service unavailable' })
      ),
    }

    vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response)

    const handler = getHandler('getReservation')
    const payload: GetReservationInput = {
      mobile: '+1234567890',
      name: 'Ada Lovelace',
    }

    const result = await handler(payload)

    expect(result.content[0].isError).toBe(true)
    expect(result.content[0].text).toContain('Failed to get the reservation')
    expect(result.content[0].text).toContain('service unavailable')
  })

  it('reports when no reservation matches the lookup', async () => {
    registerDatabaseTools(server as any, env as any)

    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify([])),
    }

    vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response)

    const handler = getHandler('getReservation')
    const payload: GetReservationInput = {
      mobile: '+1234567890',
      name: 'Ada Lovelace',
      time: '19:00',
    }

    const result = await handler(payload)

    expect(result.content[0].isError).toBe(true)
    expect(result.content[0].text).toContain('No reservation for Ada Lovelace')
    expect(result.content[0].text).toContain('at 19:00')
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
