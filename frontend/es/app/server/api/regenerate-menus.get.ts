// server/api/regenerate-menus.get.ts
// Endpoint para regenerar los menús estáticos de todas las sedes
// Puede ser llamado desde otra app con un simple GET
// Ejemplo: GET https://salchimonster.com/api/regenerate-menus

const URI = 'https://backend.salchimonster.com'

/**
 * Genera un slug válido desde el nombre de un sitio
 */
function getSiteSlug(siteName: string): string {
  if (!siteName) return ''
  return siteName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim()
}

export default defineEventHandler(async (event) => {
  try {
    // Obtener todas las sedes
    const sitesResponse = await fetch(`${URI}/sites`)
    if (!sitesResponse.ok) {
      throw new Error(`Error fetching sites: ${sitesResponse.status}`)
    }
    
    const sites = await sitesResponse.json()
    const filteredSites = (sites || []).filter(
      (s: any) => s.show_on_web && s.time_zone === 'America/Bogota' && s.site_id !== 32
    )

    const results = []
    const errors = []

    // Regenerar menús para cada sede
    for (const site of filteredSites) {
      try {
        const siteId = site.site_id
        const siteName = site.site_name
        
        if (!siteName) {
          continue // Saltar sedes sin nombre
        }

        // Obtener el menú de la sede para validar que existe
        const menuResponse = await fetch(`${URI}/tiendas/${siteId}/products-light`)
        if (!menuResponse.ok) {
          errors.push({ 
            site_id: siteId, 
            site_name: siteName, 
            error: `HTTP ${menuResponse.status}` 
          })
          continue
        }

        const menuData = await menuResponse.json()
        
        // Generar slug desde el nombre del sitio
        const slug = getSiteSlug(siteName)
        if (!slug) {
          errors.push({
            site_id: siteId,
            site_name: siteName,
            error: 'No se pudo generar slug válido'
          })
          continue
        }
        
        // Construir la URL de la página del menú
        const menuUrl = `/${slug}/`
        
        // Forzar la regeneración de la página haciendo una petición interna
        // Esto invalida el caché y fuerza la regeneración con los nuevos datos
        try {
          const host = event.node.req.headers.host || 'localhost:3000'
          const protocol = event.node.req.headers['x-forwarded-proto'] || 
                          (event.node.req.headers['x-forwarded-ssl'] === 'on' ? 'https' : 'http')
          const baseUrl = `${protocol}://${host}`
          
          // Intentar invalidar el caché usando la API de Nitro si está disponible
          try {
            // @ts-ignore - Nitro puede tener métodos de caché
            if (event.context.nitro?.cache) {
              await event.context.nitro.cache.delete(menuUrl)
            }
          } catch (cacheError) {
            // Si no está disponible, continuar con fetch HTTP
          }
          
          // Hacer una petición GET con query parameter para forzar regeneración
          // El query parameter ?_regenerate=true fuerza a Nitro a regenerar la página
          await fetch(`${baseUrl}${menuUrl}?_regenerate=${Date.now()}`, { 
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'X-Regenerate': 'true', // Header personalizado
              'User-Agent': 'Menu-Regenerator/1.0'
            }
          }).catch((err) => {
            // Log el error pero continuar con otras sedes
            console.warn(`[Regenerate] Error regenerando ${menuUrl}:`, err.message)
          })
        } catch (fetchError) {
          // Ignorar errores de fetch interno
          console.warn(`[Regenerate] Error en fetch interno para ${menuUrl}:`, fetchError)
        }

        results.push({
          site_id: siteId,
          site_name: siteName,
          slug: slug,
          menu_url: menuUrl,
          categories_count: menuData?.categorias?.length || 0,
          products_count: menuData?.categorias?.reduce((acc: number, cat: any) => 
            acc + (Array.isArray(cat.products) ? cat.products.length : 0), 0) || 0,
          status: 'success'
        })
      } catch (error: any) {
        errors.push({
          site_id: site.site_id,
          site_name: site.site_name,
          error: error.message || 'Unknown error'
        })
      }
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      total_sites: filteredSites.length,
      regenerated: results.length,
      failed: errors.length,
      results: results,
      errors: errors.length > 0 ? errors : undefined
    }
  } catch (error: any) {
    event.node.res.statusCode = 500
    return {
      success: false,
      error: error.message || 'Error regenerating menus',
      timestamp: new Date().toISOString()
    }
  }
})

