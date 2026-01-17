// @ts-ignore - Nuxt auto-imports
export default defineEventHandler(async (event: any) => {
  const URI = 'https://backend.salchimonster.com'
  
  // Obtener el hostname del request (ej: suba.salchimonster.com o salchimonster.com)
  const host = event.node.req.headers.host || ''
  const hostname = host.split(':')[0] // Quitar puerto si existe
  const protocol = event.node.req.headers['x-forwarded-proto'] || 
                   (event.node.req.headers['x-forwarded-ssl'] === 'on' ? 'https' : 'https')
  const baseUrl = `${protocol}://${hostname}`
  
  // Detectar subdominio
  const parts = hostname.split('.')
  const subdomain = parts.length >= 3 && parts[0] !== 'www' ? parts[0] : null
  
  try {
    // Obtener todas las sedes usando fetch nativo
    const response = await fetch(`${URI}/sites`)
    const sites = await response.json()
    const filteredSites = (sites || []).filter(
      (s: any) => s.show_on_web && s.time_zone === 'America/Bogota' && s.site_id !== 32
    )

    // URLs estáticas principales (siempre incluir)
    const staticUrls = [
      { loc: `${baseUrl}/`, changefreq: 'daily', priority: '1.0' },
      { loc: `${baseUrl}/sedes`, changefreq: 'weekly', priority: '0.9' },
      { loc: `${baseUrl}/carta`, changefreq: 'daily', priority: '0.9' },
      { loc: `${baseUrl}/menu`, changefreq: 'daily', priority: '0.9' },
      { loc: `${baseUrl}/franquicias`, changefreq: 'monthly', priority: '0.7' },
      { loc: `${baseUrl}/colaboraciones`, changefreq: 'monthly', priority: '0.6' },
    ]

    // Si hay subdominio, solo incluir URLs de esa sede específica
    let siteUrls: any[] = []
    if (subdomain) {
      const currentSite = filteredSites.find((s: any) => s.subdomain === subdomain)
      if (currentSite) {
        // Solo incluir URLs relevantes para esta sede
        siteUrls = [
          {
            loc: `${baseUrl}/`,
            changefreq: 'daily',
            priority: '1.0',
            lastmod: new Date().toISOString().split('T')[0]
          }
        ]
      }
    } else {
      // Si no hay subdominio (dominio principal), incluir todas las sedes
      siteUrls = filteredSites
        .filter((site: any) => site.subdomain && site.subdomain !== 'www')
        .map((site: any) => ({
          loc: `https://${site.subdomain}.salchimonster.com/`,
          changefreq: 'daily',
          priority: '0.8',
          lastmod: new Date().toISOString().split('T')[0]
        }))
    }

    const allUrls = subdomain ? siteUrls : [...staticUrls, ...siteUrls]

    // Generar XML del sitemap
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`

    event.node.res.setHeader('Content-Type', 'application/xml')
    event.node.res.setHeader('Cache-Control', 'public, max-age=3600')
    return sitemap
  } catch (error) {
    console.error('Error generating sitemap:', error)
    // Sitemap mínimo en caso de error
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/sedes</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`
    event.node.res.setHeader('Content-Type', 'application/xml')
    return fallbackSitemap
  }
})
