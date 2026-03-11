export default defineEventHandler((event) => {
  const oauthPaths = ['/api/oauth/', '/api/mcp']
  if (!oauthPaths.some(p => event.path.startsWith(p))) return

  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version, MCP-Session-Id, Accept, Last-Event-ID')
  setResponseHeader(event, 'Access-Control-Expose-Headers', 'MCP-Protocol-Version, MCP-Session-Id')

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }
})
