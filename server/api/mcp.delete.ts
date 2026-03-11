import { requireAuth } from '../utils/apiAuth'
import { getMCPSession, deleteMCPSession } from '../utils/mcpSessions'

export default defineEventHandler(async (event) => {
  let userId: string | null = null
  try {
    userId = await requireAuth(event)
  } catch {
    setResponseStatus(event, 401)
    return null
  }

  const sessionId = getHeader(event, 'mcp-session-id')
  if (!sessionId) {
    setResponseStatus(event, 400)
    return { error: 'MCP-Session-Id header required' }
  }

  const session = await getMCPSession(sessionId)
  if (!session || session.userId !== userId) {
    setResponseStatus(event, 404)
    return null
  }

  await deleteMCPSession(sessionId)
  setResponseStatus(event, 200)
  return {}
})
