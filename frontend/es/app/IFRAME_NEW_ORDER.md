# Cómo enviar señal de "Nuevo Pedido" desde el iframe padre

Este documento explica cómo enviar una señal desde el iframe padre para limpiar el carrito y redirigir a home.

## Método 1: PostMessage (Recomendado)

El iframe escucha mensajes `postMessage` del padre. Para iniciar un nuevo pedido, envía un mensaje desde el iframe padre:

```javascript
// Desde el iframe padre (la página que contiene el iframe)
const iframe = document.querySelector('iframe[src*="salchimonster.com"]')

// Enviar señal de nuevo pedido
iframe.contentWindow.postMessage({
  type: 'new-order',
  action: 'new-order'
}, '*') // Cambia '*' por el dominio específico del iframe por seguridad

// Opcional: Escuchar confirmación
window.addEventListener('message', (event) => {
  if (event.data.type === 'new-order-confirmed') {
    console.log('Nuevo pedido iniciado correctamente')
  }
})
```

### Ejemplo completo HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Mi Página con Iframe</title>
</head>
<body>
  <h1>Mi Página</h1>
  
  <button onclick="startNewOrder()">Nuevo Pedido</button>
  
  <iframe 
    id="salchimonster-iframe"
    src="https://salchimonster.com/?iframe=1"
    width="100%"
    height="800px"
    frameborder="0">
  </iframe>

  <script>
    function startNewOrder() {
      const iframe = document.getElementById('salchimonster-iframe')
      
      // Enviar señal de nuevo pedido al iframe
      iframe.contentWindow.postMessage({
        type: 'new-order',
        action: 'new-order'
      }, '*') // ⚠️ Por seguridad, cambia '*' por 'https://salchimonster.com'
      
      console.log('Señal de nuevo pedido enviada')
    }
    
    // Opcional: Escuchar confirmación
    window.addEventListener('message', (event) => {
      // Validar origen por seguridad
      if (event.origin !== 'https://salchimonster.com') return
      
      if (event.data.type === 'new-order-confirmed') {
        console.log('✅ Nuevo pedido iniciado correctamente')
      }
    })
  </script>
</body>
</html>
```

## Método 2: Endpoint POST (Alternativo)

También puedes llamar al endpoint `/api/new-order` y luego enviar el postMessage:

```javascript
// Llamar al endpoint (opcional)
fetch('https://salchimonster.com/api/new-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  console.log('Endpoint llamado:', data)
  
  // Luego enviar postMessage
  const iframe = document.querySelector('iframe[src*="salchimonster.com"]')
  iframe.contentWindow.postMessage({
    type: 'new-order',
    action: 'new-order'
  }, '*')
})
```

## Seguridad

Por seguridad, es recomendable restringir los orígenes permitidos. Para hacerlo, edita `frontend/es/app/app/app.vue` y descomenta/ajusta la validación de origen:

```javascript
function handlePostMessage(event) {
  // Lista de orígenes permitidos
  const allowedOrigins = [
    'https://tu-dominio.com',
    'https://otro-dominio.com'
  ]
  
  if (!allowedOrigins.includes(event.origin)) {
    console.warn('[App] Origen no permitido:', event.origin)
    return
  }
  
  // ... resto del código
}
```

## Qué hace la señal

Cuando se recibe la señal `new-order`:

1. ✅ Limpia el carrito (`cartStore.cart = []`)
2. ✅ Limpia el cupón aplicado (`cartStore.applied_coupon = null`)
3. ✅ Limpia la UI del cupón (`cartStore.coupon_ui = { enabled: false, draft_code: '' }`)
4. ✅ Limpia los detalles de dirección (`cartStore.address_details = {}`)
5. ✅ Limpia las notas del pedido (`cartStore.order_notes = ''`)
6. ✅ Redirige a home (`router.push('/')`)

## Notas

- El iframe debe estar cargado antes de enviar el mensaje
- El mensaje debe ser un objeto con `type: 'new-order'` o `action: 'new-order'`
- Por seguridad, siempre valida el origen del mensaje en producción
