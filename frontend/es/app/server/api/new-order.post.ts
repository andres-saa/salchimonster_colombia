// server/api/new-order.post.ts
// Endpoint alternativo para iniciar un nuevo pedido desde el iframe padre
// Puede ser llamado con POST desde el iframe padre
// Ejemplo: POST https://salchimonster.com/api/new-order

export default defineEventHandler(async (event) => {
  // Este endpoint solo retorna una respuesta de éxito
  // La lógica real de limpiar el carrito y redirigir se hace en el cliente
  // El iframe padre debe llamar a este endpoint y luego enviar un postMessage
  
  // Por seguridad, podrías validar el origen del request
  // const origin = getRequestHeader(event, 'origin')
  // const referer = getRequestHeader(event, 'referer')
  
  return {
    success: true,
    message: 'Nuevo pedido iniciado. El iframe debe escuchar postMessage para limpiar el carrito.',
    timestamp: new Date().toISOString()
  }
})
