import { createEventStream } from 'h3'
import { requireAuth } from '../utils/apiAuth'
import { getMCPSession } from '../utils/mcpSessions'

const MCP_VERSION = '2025-11-25'

function getBaseUrl(event: Parameters<typeof getHeader>[0]): string {
  const host = getHeader(event, 'host') ?? 'localhost:3000'
  const proto = getHeader(event, 'x-forwarded-proto')
    ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return `${proto}://${host}`
}

export default defineEventHandler(async (event) => {
  const baseUrl = getBaseUrl(event)
  const mcpResource = `${baseUrl}/api/mcp`

  // Must accept SSE
  const accept = getHeader(event, 'accept') ?? ''
  if (!accept.includes('text/event-stream')) {
    setResponseStatus(event, 405)
    setResponseHeader(event, 'Allow', 'GET, POST, DELETE')
    return { error: 'This endpoint requires Accept: text/event-stream for SSE streaming' }
  }

  // Authenticate
  let userId: string | null = null
  try {
    userId = await requireAuth(event)
  } catch {
    setResponseStatus(event, 401)
    setResponseHeader(event, 'WWW-Authenticate', `Bearer realm="${baseUrl}", resource="${mcpResource}"`)
    return null
  }

  // Validate session
  const sessionId = getHeader(event, 'mcp-session-id')
  if (sessionId) {
    const session = await getMCPSession(sessionId)
    if (!session || session.userId !== userId) {
      setResponseStatus(event, 404)
      return null
    }
  }

  setResponseHeader(event, 'MCP-Protocol-Version', MCP_VERSION)

  const eventStream = createEventStream(event)

  // Resume from Last-Event-ID if provided (reconnection after disconnect)
  const lastEventId = getHeader(event, 'last-event-id')
  let eventId = lastEventId ? parseInt(lastEventId) + 1 : 1

  // Heartbeat every 25s — keeps connection alive and lets server detect disconnects
  const heartbeat = setInterval(async () => {
    try {
      await eventStream.push({
        id: String(eventId++),
        event: 'ping',
        data: ''
      })
    } catch {
      clearInterval(heartbeat)
    }
  }, 25000)

  eventStream.onClosed(() => {
    clearInterval(heartbeat)
  })

  return eventStream.send()
})
