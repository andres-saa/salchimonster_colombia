// @ts-ignore - Nuxt auto-imports
export default defineEventHandler((event: any) => {
  // Obtener el hostname del request
  const host = event.node.req.headers.host || ''
  const hostname = host.split(':')[0]
  const protocol = event.node.req.headers['x-forwarded-proto'] || 'https'
  const baseUrl = `${protocol}://${hostname}`
  
  const robotsContent = `User-Agent: *
Allow: /
Disallow: /cart
Disallow: /pagar/
Disallow: /rastrear
Disallow: /sonando
Disallow: /pqr
Disallow: /gracias
Disallow: /gracias-epayco

Sitemap: ${baseUrl}/sitemap.xml
`

  event.node.res.setHeader('Content-Type', 'text/plain')
  event.node.res.setHeader('Cache-Control', 'public, max-age=3600')
  return robotsContent
})
