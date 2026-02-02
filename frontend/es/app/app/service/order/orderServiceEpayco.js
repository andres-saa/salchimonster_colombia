// app/service/order/orderServiceEpayco.js

import axios from "axios";
import { URI } from "../conection";

// Nuxt 3: stores + router desde #imports
import { usecartStore } from "#imports";
import { useSitesStore } from "#imports";
import { useUserStore } from "#imports";
import { useReportesStore } from "#imports";
import { useRouter } from "#imports";

/* ----------------------------- Helpers base ----------------------------- */

function alertMissing(msg) {
  alert(msg);
}

/**
 * Helper para obtener los stores cuando se necesitan.
 * Evita tenerlos en variables globales (mejor para SSR / tests).
 */
function getStores() {
  const cart = usecartStore();
  const site = useSitesStore();
  const user = useUserStore();
  const report = useReportesStore();
  return { cart, site, user, report };
}

/**
 * Normaliza el teléfono:
 * - Si phone_code es objeto con dialCode, usa eso.
 * - Si es string, intenta que empiece con +.
 * - Quita espacios del número.
 */
function buildPhone() {
  const { user } = getStores();

  const code = user.user?.phone_code;
  const number = user.user.phone_number?.toString().replace(/\s+/g, "") || "";

  let dial = "";
  if (!code) return null;

  if (typeof code === "string") {
    dial = code.startsWith("+") ? code : `+${code}`;
  } else if (typeof code === "object" && "dialCode" in code) {
    dial = code.dialCode || "";
    dial = dial.startsWith("+") ? dial : `+${dial}`;
  }

  if (!dial || !number) return null;
  return `${dial}${number}`;
}

/**
 * Decodifica un JWT y extrae el id del usuario.
 * Retorna null si no hay token o no se puede decodificar.
 */
function getUserIdFromToken() {
  const { user } = getStores();
  const token = user.user?.token;
  
  if (!token || typeof window === 'undefined') return null;
  
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Decodificación compatible con caracteres especiales (utf-8)
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);
    
    // Extraer el id del token decodificado
    const userId = decoded?.id || decoded?.user_id || null;
    return userId ? Number(userId) : null;
  } catch (e) {
    console.error('Error decodificando token para inserted_by:', e);
    return null;
  }
}

/* --------------------------------- Domain --------------------------------- */
function preparar_orden() {
  const { cart, site, user } = getStores();

  user.user.was_reserva = false;
  cart.sending_order = true;

  const order_products = cart.cart || []; // OBLIGATORIO: pe_json y order_products (legacy)

  // NUNCA permitir orden sin productos
  if (!order_products.length) {
    cart.sending_order = false;
    return null;
  }
  const site_id = site.location?.site?.site_id;
  // pe_site_id es requerido - asegurarse de que siempre tenga un valor
  // Si no está disponible, usar site_id como fallback (aunque idealmente debería venir del backend)
  const pe_site_id = site.location?.site?.pe_site_id ?? null;
  const final_pe_site_id = pe_site_id ?? site_id ?? null;
  const payment_method_id = user.user.payment_method_option?.id ?? null;
  const order_type_id = user.user.order_type?.id ?? null;
  const placa = user.user.placa?.toString().trim() || "";
  const address_details = cart.address_details;

  const delivery_price =
    payment_method_id === 7 ? 0 : site.location?.neigborhood?.delivery_price ?? 0;

  const baseNotes = cart?.cart?.order_notes ?? "";
  const order_notes = baseNotes || "";

  const phone = buildPhone();
  
  // Obtener código de descuento (discount_code) y cuponera (string de cuponera si aplicada; distinto de discount_code)
  const discount_code = cart.applied_cuponera?.code || cart.applied_coupon?.code || null;
  const cuponera = cart.applied_cuponera?.code ?? null; // string de cuponera si aplicada, null sino

  /* -------------------------------------------------------------------------- */
  /* LÓGICA DE DIRECCIÓN MODIFICADA                       */
  /* -------------------------------------------------------------------------- */
  
  let final_address = user.user.address || "";

  // 1. Verificamos si es Google Maps revisando si existe address_details con place_id
  const isGoogleMaps = address_details && address_details.place_id;

  // 2. Si NO es Google Maps (es parámetros), NO es Recoger, y tenemos un barrio seleccionado:
  if (!isGoogleMaps && order_type_id !== 2) {
    const neighborhoodName = site.location?.neigborhood?.name;
    if (neighborhoodName && final_address) {
       // Concatenamos el barrio al final
       final_address = `${final_address} - ${neighborhoodName}`;
    }
  }

  // Juntar first_name y last_name para user_data.user_name (orden normal y restaurant.pe)
  const firstName = (user.user.first_name?.toString().trim() || "").trim();
  const lastName = (user.user.last_name?.toString().trim() || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || user.user.name?.toString().trim() || "";

  const user_data = {
    user_name: fullName,
    user_phone: phone || "",
    user_address:
      order_type_id === 2
        ? "recoger / pick up"
        : final_address, // Usamos la dirección ya procesada
    email: user.user.email?.toString().trim() || "",
  };

  /* -------------------------------------------------------------------------- */
  
  // Obtener inserted_by del token si hay usuario logueado
  const inserted_by = getUserIdFromToken();

  /* -------------------------------------------------------------------------- */
  /* LÓGICA RAPPI CARGO                                                         */
  /* -------------------------------------------------------------------------- */
  
  // Usar el flag persistido is_rappi_cargo del cartStore (prioridad)
  // Si no está disponible o es undefined/null, calcularlo desde address_details (compatibilidad hacia atrás)
  let isRappiCargo = false;
  
  // Prioridad 1: Usar flag persistido si está disponible
  if (cart.is_rappi_cargo === true || cart.is_rappi_cargo === false) {
    isRappiCargo = cart.is_rappi_cargo;
  } else {
    // Prioridad 2: Calcular desde address_details si el flag no está disponible
    const addressData = address_details || site.location?.address_details || {};
    
    // Usar método del store si está disponible
    if (cart.calculateIsRappiCargo && typeof cart.calculateIsRappiCargo === 'function') {
      isRappiCargo = cart.calculateIsRappiCargo(addressData);
    } else {
      // Fallback: calcular manualmente
      // Prioridad 1: Si rappi_validation existe y no es null → es Rappi Cargo
      if (addressData.rappi_validation != null && typeof addressData.rappi_validation === 'object') {
        isRappiCargo = true;
      }
      // Prioridad 2: Si delivery_pricing.uses_rappi === true → es Rappi Cargo
      else if (addressData.delivery_pricing?.uses_rappi === true) {
        isRappiCargo = true;
      }
    }
  }

  // Construir json_cargo si es rappi cargo (independientemente del tipo de orden)
  let json_cargo = null;
  if (isRappiCargo) {
    // Calcular total_value (subtotal + delivery - descuentos)
    const subtotal = cart.cartSubtotal || 0;
    const totalDiscount = cart.cartTotalDiscount || 0;
    const totalValue = subtotal + delivery_price - totalDiscount;

    // Mapear payment_method_id a string
    const paymentMethodMap = {
      9: 'ONLINE',
      8: 'CASH',
      5: 'CASH', // DATAFONO
      6: 'ONLINE', // TRANSFERENCIA
    };
    const paymentMethod = paymentMethodMap[payment_method_id || 0] || 'CASH';

    // Extraer datos del cliente para json_cargo
    // Usar first_name y last_name directamente del user store
    // Si no están disponibles, intentar extraer del user_data.user_name
    let firstName = (user.user.first_name?.toString().trim() || "").trim();
    let lastName = (user.user.last_name?.toString().trim() || "").trim();
    
    // Si no hay first_name o last_name, intentar extraer del user_data.user_name
    if (!firstName && !lastName && user_data.user_name) {
      const nameParts = (user_data.user_name || '').trim().split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }
    
    // Asegurar que last_name nunca esté vacío (requerido por la API de cargo)
    // Si está vacío, usar "N/A" como fallback
    if (!lastName || lastName.trim() === '') {
      lastName = firstName || 'N/A';
    }
    
    // Asegurar que first_name tampoco esté vacío
    if (!firstName || firstName.trim() === '') {
      firstName = 'N/A';
    }

    // Extraer datos de dirección desde address_details o user_data
    // Compatible con ambos formatos (Rappi Cargo y Google Maps)
    const addressData = address_details || site.location?.address_details || {};
    const clientAddress = user_data.user_address || addressData.formatted_address || addressData.address || '';
    
    // Lat/Lng: compatible con ambos formatos (latitude/longitude o lat/lng)
    const clientLat = addressData.latitude || addressData.lat || user.user.lat || null;
    const clientLng = addressData.longitude || addressData.lng || user.user.lng || null;
    
    // Extraer complemento/comentarios (podría estar en order_notes o en address_details)
    const complement = addressData.complement || addressData.address_complement || '';
    const comments = order_notes && order_notes !== 'SIN NOTAS' ? order_notes : '';
    
    // Extraer ciudad: desde matching_polygons[0].site.city_name o address_details o site
    let city = 'Bogota'; // Default
    if (addressData.matching_polygons && addressData.matching_polygons.length > 0) {
      const matchingPolygon = addressData.matching_polygons.find((p) => p.site);
      if (matchingPolygon?.site?.city_name) {
        city = matchingPolygon.site.city_name;
      }
    }
    if (city === 'Bogota') {
      city = addressData.city || site.location?.site?.city_name || site.location?.site?.city || 'Bogota';
    }
    
    // Extraer código postal si está disponible
    const zipCode = addressData.zip_code || addressData.postal_code || '';

    // Extraer picking_point_external_id desde matching_polygons
    let pickingPointExternalId = null;
    if (addressData.matching_polygons && addressData.matching_polygons.length > 0) {
      const matchingPolygon = addressData.matching_polygons.find((p) => p.site);
      if (matchingPolygon?.site?.picking_point_external_id) {
        pickingPointExternalId = matchingPolygon.site.picking_point_external_id;
      }
    }

    // Construir productos para action_points
    const products = (order_products || []).map((product) => {
      // Construir URL de imagen
      let imageUrl = '';
      if (product.productogeneral_urlimagen) {
        imageUrl = `https://img.restpe.com/${product.productogeneral_urlimagen}`;
      } else if (product.img_identifier) {
        imageUrl = `${URI}/read-photo-product/${product.img_identifier}`;
      }

      return {
        product_id: String(product.pedido_productoid || ''),
        name: product.pedido_nombre_producto || '',
        description: product.pedido_nombre_producto || '', // Usar el nombre como descripción
        units: Number(product.pedido_cantidad || 1),
        ean: String(product.pedido_productoid || ''), // Usar product_id como EAN
        image_url: imageUrl,
        unit_price: Number(product.pedido_base_price || product.pedido_precio || 0)
      };
    });

    // Construir action_points
    const actionPoints = [];
    
    // PICK_UP: Recoger en la tienda
    if (pickingPointExternalId && products.length > 0) {
      actionPoints.push({
        external_picking_point_id: pickingPointExternalId,
        instructions: `Recoger pedido de ${site.location?.site?.site_name || 'la tienda'}`,
        products: products,
        action_type: 'PICK_UP',
        location_type: 'STORE'
      });
    }

    // DROP_OFF: Entregar al cliente
    actionPoints.push({
      products: [], // Los productos ya se entregaron en PICK_UP
      action_type: 'DROP_OFF',
      location_type: 'CLIENT'
    });

    // Construir json_cargo
    json_cargo = {
      total_value: Math.max(0, totalValue),
      user_tip: 0, // Por ahora 0, podría ser un campo futuro
      vehicle_type: 'BIKE',
      payment_method: paymentMethod,
      action_points: actionPoints,
      client_info: {
        email: user_data.email || '',
        phone: (user_data.user_phone || '').replace(/\s+/g, ''), // Quitar espacios
        first_name: firstName,
        last_name: lastName,
        address: clientAddress,
        lat: clientLat,
        lng: clientLng,
        complement: complement,
        city: city,
        comments: comments,
        zip_code: zipCode
      },
      order_id: null, // Se generará después de enviar la orden
      in_store_reference_id: site_id?.toString() || ''
    };
  }

  const order = {
    order_products: [], // legacy: backend lo espera vacío, los productos van en pe_json
    site_id,
    pe_site_id: final_pe_site_id, // Asegurar que siempre tenga un valor
    order_type_id,
    placa,
    delivery_person_id: 4,
    payment_method_id,
    delivery_price,
    order_notes: order_notes || "SIN NOTAS",
    user_data,
    order_aditionals: [],
    pe_json: order_products, // OBLIGATORIO: siempre enviar productos del carrito
    address_details: address_details,
    discount_code: discount_code,
    cuponera: cuponera,
    total: 0,
    cargo: isRappiCargo, // Campo boolean indicando si es rappi cargo
    ...(json_cargo ? { json_cargo } : {}), // Incluir json_cargo solo si es rappi cargo
    ...(inserted_by ? { inserted_by } : {}), // Incluir inserted_by solo si hay usuario logueado
  };

  return order;
}

const preparar_orden_reserva = () => {
  const { cart, site, user } = getStores();

  user.user.was_reserva = true;
  cart.sending_order = true;

  const order_products = cart.cart.products.map((p) => {
    return { product_instance_id: p.product.id, quantity: p.quantity };
  });

  const order_notes = cart.cart.order_notes;

  const site_id = site.location.siteReservas.site_id;
  const payment_method_id = user.user.payment_method_option?.id;
  const delivery_price = 0;

  const user_data = {
    user_name: user.user.name,
    user_phone: user.user.phone_number?.split(" ").join(""),
    user_address: `Debe ir a la sede` || "",
  };

  const order = {
    order_products,
    site_id,
    delivery_person_id: 4,
    payment_method_id,
    delivery_price,
    order_notes: order_notes || "SIN NOTAS",
    user_data,
    order_aditionals: [],
  };

  return order;
};

/* ------------------------------ Validaciones ------------------------------ */

function validateOrder(order) {
  const { cart, user } = getStores();

  // 0) Productos obligatorios: una orden NUNCA puede estar sin productos
  const products = order.pe_json || order.order_products || [];
  if (!products.length) {
    alertMissing("Error: El carrito está vacío. Agrega productos antes de enviar el pedido.");
    cart.sending_order = false;
    return false;
  }

  // 1) Método de entrega obligatorio
  if (!order.order_type_id) {
    alertMissing("Error: Debe seleccionar un método de entrega.");
  }

  // 2) Placa si es 'Pasar a recoger' (id 2) y la sede es 33
  if (order.order_type_id === 2 && order.site_id === 33) {
    if (!order.placa || order.placa.trim() === "") {
      alertMissing(
        "Error: Debe proporcionar la placa del vehículo para recogida."
      );
    }
  }

  // 3) Teléfono + código
  if (!order.user_data.user_phone || order.user_data.user_phone.trim() === "") {
    const hasPhoneCode = !!user.user?.phone_code;
    const hasPhoneNumber = !!user.user.phone_number?.toString().trim();
    if (!hasPhoneCode) {
      alertMissing("Error: El código de país del teléfono es obligatorio.");
    }
    if (!hasPhoneNumber) {
      alertMissing("Error: Debe ingresar su número de teléfono.");
    }
  }

  // 4) Nombre y Apellido
  const firstName = user.user.first_name?.toString().trim() || "";
  const lastName = user.user.last_name?.toString().trim() || "";
  const oldName = user.user.name?.toString().trim() || "";
  
  // Si se está usando el nuevo formato (first_name/last_name), ambos son obligatorios
  if (firstName || lastName) {
    // Si hay first_name pero no last_name, requerir apellido
    if (firstName && !lastName) {
      alertMissing("Error: Debe ingresar su apellido.");
      return false;
    }
    // Si hay last_name pero no first_name, requerir nombre
    if (lastName && !firstName) {
      alertMissing("Error: Debe ingresar su nombre.");
      return false;
    }
  } else {
    // Si no se está usando el nuevo formato, verificar el formato antiguo (name)
    if (!oldName) {
      alertMissing("Error: Debe ingresar su nombre.");
      return false;
    }
  }

  // 5) Dirección (excepto recoger)
  if (order.order_type_id !== 2) {
    if (
      !order.user_data.user_address ||
      order.user_data.user_address.trim() === ""
    ) {
      alertMissing("Error: Debe ingresar su dirección.");
    }
  }

  // 6) Email (obligatorio y formato válido)
  const email = order.user_data.email?.toString().trim() || "";
  if (!email) {
    alertMissing("Error: El correo electrónico es obligatorio.");
    return false;
  }
  
  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alertMissing("Error: Por favor ingresa un correo electrónico válido.");
    return false;
  }

  // 7) Site y delivery_price
  if (!order.site_id) {
    alertMissing("Error: Debe seleccionar una sede válida.");
  }
  if (order.delivery_price == null) {
    alertMissing("Error: El costo de envío no está disponible para su zona.");
  }

  // 8) Método de pago
  if (!order.payment_method_id && order.payment_method_id !== 0) {
    alertMissing("Error: Debe seleccionar un método de pago.");
  }

  const ok =
    !!order.order_type_id &&
    !(order.order_type_id === 2 &&
      order.site_id === 33 &&
      (!order.placa || order.placa.trim() === "")) &&
    !!order.user_data.user_name &&
    order.user_data.user_name.trim() !== "" &&
    !!order.user_data.user_phone &&
    order.user_data.user_phone.trim() !== "" &&
    !!order.user_data.email &&
    order.user_data.email.trim() !== "" &&
    !!order.site_id &&
    order.delivery_price != null &&
    (order.order_type_id === 2 ||
      (order.user_data.user_address &&
        order.user_data.user_address.trim() !== "")) &&
    (order.payment_method_id || order.payment_method_id === 0);

  if (!ok) {
    cart.sending_order = false;
    return false;
  }

  return true;
}

/* --------------------------------- Service -------------------------------- */

export const orderServiceEpayco = {
  async sendOrder() {
    const { cart, report, user } = getStores();
    const router = useRouter();

    const order = preparar_orden();

    if (!order) {
      cart.sending_order = false;
      alertMissing("Error: El carrito está vacío. Agrega productos antes de enviar el pedido.");
      return null;
    }

    if (!validateOrder(order)) {
      cart.sending_order = false;
      return null;
    }

    try {
      report.setLoading(true, `enviando tu pedido ${user.user.name}`);
      const response = await axios.post(`${URI}/order`, order);

      if (response.status === 200) {
        cart.sending_order = false;
        cart.last_order = response.data;
        report.setLoading(false, "enviando tu pedido");

        if (order.payment_method_id == 9) {
          router.push(`/pagar/${response.data}`);
        }
        // aquí solo devolvemos los datos; redirección la puedes manejar afuera
        return cart.last_order;
        
      } else {
        console.error(
          "An error occurred while sending the order:",
          response.status
        );
        alertMissing(
          "An error occurred while sending the order. Please try again."
        );
        report.setLoading(false, "enviando tu pedido");
        cart.sending_order = false;
        return null;
      }
    } catch (error) {
      console.error("An error occurred while sending the order:", error);
      report.setLoading(false, "enviando tu pedido");
      cart.sending_order = false;

      alertMissing(
        "An error occurred while sending the order. Please check your internet connection and try again."
      );
      return null;
    }
  },

  preparar_orden() {
    return preparar_orden();
  },

  async sendOrderReserva() {
    const { cart, report, user } = getStores();
    const router = useRouter();

    const order = preparar_orden_reserva();
    user.user.was_reserva = true;

    if (!validateOrder(order)) {
      cart.sending_order = false;
      return null;
    }

    try {
      report.setLoading(true, `enviando tu pedido ${user.user.name}`);
      const response = await axios.post(`${URI}/order`, order);

      if (response.status === 200) {
        cart.sending_order = false;
        cart.last_order = response.data;
        report.setLoading(false, "enviando tu pedido");

        router.push("/gracias");
        return cart.last_order;
      } else {
        console.error(
          "An error occurred while sending the order:",
          response.status
        );
        alertMissing(
          "An error occurred while sending the order. Please try again."
        );
        report.setLoading(false, "enviando tu pedido");
        cart.sending_order = false;
        return null;
      }
    } catch (error) {
      console.error("An error occurred while sending the order:", error);
      report.setLoading(false, "enviando tu pedido");
      cart.sending_order = false;

      alertMissing(
        "An error occurred while sending the order. Please check your internet connection and try again."
      );
      return null;
    }
  },
};
