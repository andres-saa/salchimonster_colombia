// @ts-ignore - Nuxt auto-imports
export default defineEventHandler(async (event: any) => {
  const URI = 'https://backend.salchimonster.com'
  
  // Obtener el hostname del request
  const host = event.node.req.headers.host || ''
  const hostname = host.split(':')[0]
  const protocol = event.node.req.headers['x-forwarded-proto'] || 
                   (event.node.req.headers['x-forwarded-ssl'] === 'on' ? 'https' : 'https')
  const baseUrl = `${protocol}://${hostname}`
  
  /**
   * Convierte el nombre de un sitio a un slug válido para URL
   */
  function getSiteSlug(siteName: string): string {
    if (!siteName) return ''
    
    return siteName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
      .replace(/[^a-z0-9]+/g, '-') // Reemplazar espacios y caracteres especiales con guiones
      .replace(/^-+|-+$/g, '') // Quitar guiones al inicio y final
      .trim()
  }
  
  try {
    // Obtener todas las sedes usando fetch nativo
    const response = await fetch(`${URI}/sites`)
    const sites = await response.json()
    const filteredSites = (sites || []).filter(
      (s: any) => s.show_on_web && s.time_zone === 'America/Bogota' && s.site_id !== 32
    )

    // URLs estáticas principales
    const staticUrls = [
      { loc: `${baseUrl}/`, changefreq: 'daily', priority: '1.0', lastmod: new Date().toISOString().split('T')[0] },
    ]

    // Generar URLs para todas las sedes usando slugs
    const siteUrls = filteredSites
      .filter((site: any) => site.site_name) // Solo sitios con nombre
      .map((site: any) => {
        const slug = getSiteSlug(site.site_name)
        return {
          loc: `${baseUrl}/${slug}/`,
          changefreq: 'daily',
          priority: '0.8',
          lastmod: new Date().toISOString().split('T')[0]
        }
      })
      .filter((url: any) => url.loc && url.loc !== `${baseUrl}//`) // Filtrar slugs vacíos

    const allUrls = [...staticUrls, ...siteUrls]

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
</urlset>`
    event.node.res.setHeader('Content-Type', 'application/xml')
    return fallbackSitemap
  }
})
