# ARISE Athletic Shop — Especificaciones completas del sistema

Actualizado: 18 de octubre de 2026

El sistema tiene dos partes que comparten la misma base de datos:

- **Parte 1 — Tienda virtual y pagos:** sitio público donde el cliente ve productos y ofertas, arma su carrito, paga en línea o por transferencia y da seguimiento a su pedido.
- **Parte 2 — Punto de venta (POS):** panel interno con 14 módulos para vender en caja, controlar inventario, pedidos en línea, clientes, proveedores, gastos, sueldos, reportes y metas de ahorro.

Al final hay un **Anexo técnico** con la infraestructura, la API, las variables de configuración, los scripts y los errores o pendientes detectados.

---

## Parte 1: Tienda virtual y pagos

### 1.1 Página de inicio (`/`)

**Datos que carga**

- Productos con estado "Activo" (los inactivos no se muestran).
- Ofertas activas y vigentes por fecha.

**Barra de navegación**

- Fija arriba; cambia de fondo y sombra al bajar la página.
- Logo y texto "Arise / Athletic Shop".
- Enlaces: Inicio, Catálogo, Ofertas, Contacto (bajan a cada sección).
- Botón de búsqueda: baja al catálogo y pone el cursor en el buscador.
- Ícono de carrito con contador animado (muestra 1 decimal si hay productos a granel).
- Botón "Acceso" (lleva al login del POS).
- En celular: menú hamburguesa animado que incluye Acceso.

**Portada (Hero)**

- Fondo con cuadrícula neón y manchas de color difuminadas.
- Etiqueta "Ropa deportiva & fitness", título "Arise Athletic Shop", lema "Eleva tu potencial. Domina tu estilo." y texto descriptivo.
- Botones "Explorar colección" (va al catálogo) y "Ver ofertas" (va a ofertas).
- Imagen principal; si no existe, muestra el logo flotando con anillos neón.
- Franja decorativa de energía debajo.

**Sección Ofertas**

- Tarjeta por oferta: imagen, etiqueta "-X%" (calculada de precio normal contra precio de oferta), etiqueta "Oferta", título, descripción (hasta 3 líneas), hasta 5 productos incluidos, precio de oferta, precio normal tachado y "Válida hasta (fecha)".
- Sin ofertas: "Por ahora no hay ofertas activas."
- Las ofertas son informativas: no tienen botón de compra ni cambian precios.

**Productos destacados**

- Hasta 6 productos marcados como "destacado" en el POS.
- Imagen, nombre, precio ("/kg" si es a granel) y botón "Agregar".

**Catálogo**

- Filtro por categoría con botones ("Todo" + categorías en orden alfabético).
- Buscador por nombre, categoría, descripción o código, con botón para limpiar y contador "N resultados para …".
- Paginación: 12 productos por página, hasta 7 botones de página con primera/última y puntos suspensivos, botones Anterior/Siguiente, texto "Mostrando a–b de N productos". Al cambiar de página sube al inicio del catálogo; al cambiar filtros regresa a la página 1.
- Tarjeta de producto: imagen (o ícono de bolsa si no tiene), categoría, etiqueta "A granel", nombre, descripción (o "Disponible en ARISE Athletic Shop."), precio, etiqueta "Disponible" y botón "Agregar al carrito".
- Sin resultados: mensaje y botón "Limpiar filtros".

**Aviso al agregar al carrito**

- Mensaje "(producto) agregado al carrito" con enlace "Ver carrito"; se oculta solo a los 2.2 segundos.

**Contacto**

- Tarjetas de WhatsApp (abre chat con "Hola ARISE Athletic Shop, quisiera hacer un pedido"), teléfono, correo, dirección, horarios y redes (Instagram, Facebook, TikTok).
- Cada dato solo aparece si está configurado; si no hay ninguno: "Muy pronto publicaremos nuestros canales de atención." (Hoy todos están vacíos.)

**Pie de página**

- Logo, lema "Tu estilo. Tu fuerza. Tu evolución.", enlaces a secciones, Carrito y "Acceso administrador", datos de contacto y "© (año) ARISE Athletic Shop".

**Botón flotante de WhatsApp**

- Esquina inferior derecha; se expande a "Escríbenos" al pasar el cursor. Solo aparece si hay número configurado (hoy está oculto).

**Animaciones**

- Aparición escalonada al hacer scroll, elevación de tarjetas al pasar el cursor.

### 1.2 Carrito (`/carrito`) — paso 1

- Indicador de pasos: 1 Carrito → 2 Datos y pago → 3 Confirmar.
- Enlace "← Seguir comprando".
- Se guarda en el navegador: no se pierde al cerrar o recargar (los carritos guardados con el nombre anterior se migran solos).
- Por producto: imagen, nombre, precio unitario ("/kg" si es granel), botones −/+ (de 0.5 kg en granel, de 1 en piezas), cantidad editable (0 o menos lo quita), total de la línea y enlace "Quitar".
- Botón "Vaciar carrito".
- Resumen: productos (unidades), envío ("Gratis al recoger · $X a domicilio", con la comisión configurada en el POS), subtotal y botón "Proceder al pago" con la nota de métodos aceptados.
- Carrito vacío: mensaje y enlace al catálogo.
- Las existencias se validan al confirmar el pedido: si no alcanza, se avisa cuántas quedan.

### 1.3 Checkout (`/checkout`) — paso 2

**Al abrir**

- Consulta la configuración de pagos (métodos activos, costo de envío, datos bancarios).
- Modo edición (`/checkout?pedido=N&t=token`): carga el pedido existente en el carrito y el formulario. Si el pedido ya está pagado o rechazado, manda a la página del pedido.

**Formulario**

- Tus datos: nombre completo (obligatorio), teléfono/WhatsApp (obligatorio), correo (opcional).
- ¿Cómo lo quieres recibir?
  - Recoger en tienda: sin costo.
  - Envío a domicilio: muestra la comisión del repartidor (configurable; $10 por defecto) y pide dirección (obligatoria) y referencias (opcional).
- Método de pago, en este orden: transferencia bancaria (seleccionada por defecto), tarjeta (Stripe), Mercado Pago y efectivo.
  - Solo aparecen los métodos activos; si falla la configuración, solo transferencia y efectivo.
  - Si Stripe aún no está activado: aviso "Tarjeta aún no disponible".
  - Transferencia muestra el procedimiento en 4 pasos.
- Notas del pedido (por ejemplo, talla o color).

**Validaciones**

- Nombre, teléfono, dirección (si es envío) y carrito con productos. Los errores aparecen en un recuadro de alerta.

**Totales**

- Envío = comisión configurada si es a domicilio; 0 si recoge.
- Total = subtotal + envío. Lista de productos con cantidades.

**Al confirmar ("Confirmar pedido" o "Guardar y continuar" en edición)**

- Crea el pedido (o lo actualiza en edición).
- Stripe: abre la página de pago de Stripe.
- Mercado Pago: abre la página de pago de Mercado Pago.
- Si la pasarela falla, abre la página del pedido para reintentar o cambiar de método (no se duplica el pedido).
- Transferencia o efectivo: vacía el carrito y abre la página del pedido.

### 1.4 Página del pedido (`/pedido/N?t=token`) — paso 3

- El enlace lleva un token secreto: solo quien hizo el pedido (o el personal con sesión) puede verlo, subir comprobante o pagarlo. Los correos y los regresos de Stripe y Mercado Pago incluyen el token.

**Carga y confirmación de pago**

- Consulta el pedido.
- Si regresa de Stripe con pago exitoso y aún no aparece pagado: confirma con Stripe y vuelve a revisar cada 2.5 segundos, hasta 8 veces.
- Si regresa de Mercado Pago: lee el número de pago de la URL, lo confirma con Mercado Pago y vuelve a revisar igual que con Stripe.
- Vacía el carrito cuando el pago queda confirmado.

**Mensajes según el resultado**

- "¡Pago confirmado!"
- "Estamos confirmando tu pago…"
- "El pago se canceló. Tu pedido sigue pendiente" (con botón para reintentar con tarjeta).

**Estado de pago**

- Etiqueta: Pago pendiente, En revisión, Pago confirmado o Pago rechazado.

**Cambiar método de pago**

- Botón "← Atrás, cambiar método de pago" (arriba y abajo). Solo si el pedido no está pagado, rechazado, cancelado, entregado ni listo. Regresa los productos al carrito y abre el checkout en modo edición.

**Según el estado y método**

- Pagado: recuadro verde de éxito.
- Rechazado: recuadro rojo "Pago no confirmado".
- Transferencia:
  - 4 pasos: transferir el total exacto, avisar por WhatsApp, esperar la verificación, si no llega el pago el pedido se cancela.
  - Datos bancarios (titular, banco, número de cuenta, CLABE, tarjeta), cada uno con botón "Copiar" que muestra "¡Copiado!" 1.5 segundos. Si la tienda no los ha capturado, se pide escribir por WhatsApp.
  - "Notificar por WhatsApp con captura": abre WhatsApp con número de pedido, productos, total y método.
  - "Subir captura del movimiento" (o "Cambiar captura"): imagen de hasta 8 MB; al subirla muestra confirmación, abre WhatsApp con "ya realicé la transferencia" y después indica "Captura recibida".
- Efectivo: indica que se paga al recibir (envío) o al recoger.
- Tarjeta o Mercado Pago pendientes: "Estamos esperando la confirmación del pago…", botón "Pagar con tarjeta" o "Pagar con Mercado Pago" y "Actualizar estado".

**Resumen**

- Productos, subtotal, envío (monto, "Gratis" si cuesta 0, o "—" si recoge), total, forma de entrega ("Envío a (dirección)" o "Recoger en tienda") y cliente (nombre y teléfono).
- Enlace "Escríbenos por WhatsApp".

### 1.5 Pasarelas y reglas de pago

| Método | Cómo funciona | Cuándo queda pagado |
| --- | --- | --- |
| Transferencia | Datos bancarios + foto del comprobante | Cuando la tienda pulsa "Confirmar pago" en el POS |
| Tarjeta (Stripe) | Página de pago de Stripe en español | Automático: al regresar el cliente o por aviso de Stripe (webhook) |
| Mercado Pago | Página de pago de Mercado Pago | Automático, por aviso de Mercado Pago (webhook) |
| Efectivo | Paga al recoger o al recibir | Manualmente desde el POS |

**Stripe**

- Cobro en pesos (moneda configurable), solo tarjeta, idioma español.
- Desglose por producto más una línea "Envío a domicilio".
- Descripción del cobro "ARISE Athletic Shop pedido #N"; en el estado de cuenta aparece "ARISE ATHLETIC".
- Texto en el botón de pago: "Pago seguro con Stripe · ARISE Athletic Shop".
- Envía el correo del cliente a Stripe para su recibo.
- Revisa que la cuenta de Stripe esté activada para cobrar (lo consulta cada 60 segundos); si no, el método se oculta y se avisa.
- No permite volver a cobrar un pedido ya pagado.
- Webhook con firma verificada; atiende pagos completados y pagos diferidos exitosos.

**Mercado Pago**

- Preferencia de pago con productos y envío, referencia al número de pedido.
- Regresa al cliente a su pedido (éxito, cancelado o pendiente) y aprueba automáticamente.
- Webhook con verificación de firma (si se configura la clave secreta) que consulta el pago y, si está aprobado y cubre el total, marca el pedido pagado.
- Confirmación directa cuando el cliente regresa a la tienda, sin esperar al webhook.

**Reglas generales**

- El servidor toma precios, nombres y costo de envío de la base de datos (no de lo que manda el navegador), valida que el producto esté activo y que haya existencias.
- El inventario se descuenta una sola vez, cuando el pago queda confirmado (no al crear el pedido).
- Estados de pago: pendiente, en revisión (transferencias), pagado, rechazado.
- Estados del pedido: nuevo, confirmado, preparando, listo, entregado, cancelado.
- Un pedido se puede editar mientras no esté pagado, rechazado, cancelado, listo o entregado, ni tenga el inventario descontado.
- Requisito: Stripe y Mercado Pago solo funcionan con sus claves cargadas en el servidor; Mercado Pago necesita además la URL pública del backend.

### 1.6 Correos automáticos

Se envían desde Gmail con diseño de la marca (fondo oscuro, logo ARISE, número de pedido, método, tipo de entrega, tabla de productos, envío, total y botón). Se mandan en segundo plano: si un correo falla, el pedido no se afecta y el error queda en el registro del servidor.

| Evento | Recibe | Asunto | Botón |
| --- | --- | --- | --- |
| Pedido nuevo por transferencia | Tienda | Nuevo pedido #N por transferencia · $total | Revisar en el POS |
| Pedido nuevo por transferencia | Cliente | Recibimos tu pedido #N · ARISE Athletic Shop | Ver mi pedido y datos de pago |
| Cliente sube comprobante | Tienda | Comprobante recibido · pedido #N · $total | Verificar pago |
| Tienda confirma el pago | Cliente | Pago confirmado · pedido #N | Ver mi pedido |
| Tienda rechaza el pago | Cliente | No pudimos confirmar tu pago · pedido #N (con motivo) | Ver mi pedido |
| Pago Stripe o Mercado Pago aprobado | Tienda | Nuevo pedido #N pagado · método · $total | Ver en el POS |
| Pago Stripe o Mercado Pago aprobado | Cliente | Pago confirmado · pedido #N | Ver mi pedido |

- El correo a la tienda incluye nombre, teléfono, correo, dirección (si es envío) y notas.
- El correo de pago confirmado cambia el texto según sea envío o recoger en tienda.
- El cliente solo recibe correos si dejó su correo.
- No se repiten: confirmar o rechazar dos veces no manda otro correo.
- Si un pedido existente se cambia a transferencia, también se manda el aviso de pedido nuevo.
- Los datos del cliente se escapan para evitar inyección de código en el correo.
- Sin las variables de correo en el servidor no se envía nada.

### 1.7 Diseño, marca y experiencia

- Título del sitio "ARISE Athletic Shop | Ropa Deportiva y Fitness", palabras clave en español, vista previa para redes (Open Graph y Twitter), idioma es-MX, ícono y color de tema.
- Paleta ARISE: fondo #07050B, tarjetas #160A24, neón #A100FF, violeta #7900FF, fucsia #FF00E5, lavanda #D98BFF, con degradados y brillos.
- Tipografías Inter (texto) y Rajdhani (títulos).
- Componentes de estilo propios: botones neón, tarjetas neón, campos neón, etiquetas y textos con degradado.
- Adaptable a celular, tablet y computadora, con márgenes seguros para pantallas con muesca.
- Respeta "reducir movimiento" del dispositivo.
- Accesibilidad: errores anunciados, textos para lector de pantalla en los pasos, zoom hasta 5x.
- Pendiente: faltan los archivos `arise-logo.png` y `hero-arise.jpg`; hoy se ven reemplazos genéricos.

---

## Parte 2: Punto de venta (POS)

### 2.1 Acceso y modo administrador

**Inicio de sesión (`/acceso`)**

- Logo, nombre, lema y "Panel de administración y punto de venta".
- Usuario principal (definido en el servidor) o correo y contraseña de un usuario creado en Configuración. Valida que no estén vacíos y muestra el error del servidor. Botón "Entrando…" mientras carga.
- El servidor entrega una sesión firmada que dura 12 horas; todas las páginas del POS la exigen y, si vence, regresan al login.
- "Cerrar sesión" borra la sesión del equipo.
- Al entrar va al Dashboard. Enlace "← Volver a la página principal".

**Modo administrador**

- Se activa con el candado del Dashboard y una contraseña distinta a la del login. El servidor entrega una sesión de administrador y valida cada operación de administrador.
- Al entrar abre Configuración y muestra una franja fucsia "Ingresaste al modo administrador" (se puede ocultar) o "Modo administrador activo", con botón "Salir del modo administrador".
- Dura mientras la pestaña del navegador esté abierta.
- Módulos solo para administrador: Ofertas, Pedidos, Gastos Admin, Deudas, Sueldos, Reportes, Historial y Configuración. Sin modo administrador redirigen al Dashboard.
- Sin modo administrador también se oculta: valor del inventario, crear ofertas y el total de compras de cada cliente.

**Permisos**

| Quién | Qué puede hacer |
| --- | --- |
| Usuario principal | Vender, clientes, deudores, proveedores, consultar productos |
| Usuario de Configuración | Lo anterior según sus permisos: hacer ventas, actualizar productos, dar de baja productos, borrar productos |
| Modo administrador | Todo |

- Los permisos se aplican en pantalla (botones ocultos) y en el servidor (operación rechazada).

**Menú lateral**

- En orden: Dashboard, Productos, Ofertas, Proveedores, Ventas, Pedidos (con contador de pedidos por verificar), Clientes, Deudores, Gastos Admin, Deudas, Sueldos, Reportes, Historial, Configuración y Cerrar sesión.
- Logo y "ARISE / Athletic Shop" arriba; etiqueta "Modo administrador" cuando está activo.
- La opción activa se resalta con degradado morado-fucsia.
- Computadora: menú fijo de 240 px. Celular: encabezado con el nombre de la página y menú deslizable que se cierra al navegar.

### 2.2 Dashboard (`/pos/dashboard`)

- Encabezado con fecha de hoy, botón "Actualizar", botón "Historial" y candado de modo administrador.
- Portada animada en 3D: pesas, discos, kettlebells y una figura geométrica flotando en morado y fucsia, con el saludo "¡Bienvenido de nuevo! 💪" y la fecha.
- Indicadores con números animados: productos activos, transacciones de hoy y productos con stock bajo (stock igual o menor al mínimo).
- Ventas recientes: últimas 5 con número, fecha y total, y enlace "Ver todas".
- Productos más vendidos: top 5 por cantidad, con stock, unidades y monto. Sin ventas muestra los primeros productos con 0 vendidos.

### 2.3 Ventas en caja (`/pos`)

**Buscar y agregar productos**

- Campo de código de barras con el cursor listo al abrir: busca con Enter, con el botón "Buscar" o solo a los 200 ms de llegar a 8 caracteres.
- Buscador por nombre o código (espera 300 ms al escribir). Muestra el primer resultado con código, categoría, precio y stock, y botón "Agregar al carrito" o "Vender por peso (kg)". Deshabilitado si no hay stock.
- Botones de categoría ("Todas" + categorías) y cuadrícula con los primeros 12 productos ("Productos disponibles (N)"); se oculta mientras se busca. Muestra esqueletos de carga.

**Venta por peso (granel)**

- Ventana "Venta por peso" con precio por kg y stock. Peso en kg con 2 decimales; valida que sea mayor a 0 y no exceda el stock. Enter confirma.

**Carrito de venta**

- No deja agregar sin stock y limita la cantidad al stock.
- Precio editable en cada línea (precio de venta).
- Botones −/+ (de 1 en piezas, de 0.1 en granel), cantidad editable en granel y botón ✕ para quitar.
- Botón "Devoluciones" (lleva a la pestaña de devoluciones del Historial).

**Cliente**

- "Cliente general" o un cliente registrado (muestra su teléfono).

**Cobro**

- Muestra número de productos y total.
- Monto pagado con separador de miles y 2 decimales; se formatea al salir del campo. Enter cobra.
- Botón "Pagado completo" llena el total. Si se deja vacío se toma como pagado completo.
- Cambio (recuadro verde) si paga de más; pendiente (recuadro ámbar) si paga de menos.
- Botón "Cobrar e Imprimir" o "Registrar Venta con Crédito" con la nota "Se registrará una deuda de $X".
- Valida que lo pagado no sea negativo ni mayor al doble del total.
- Al cobrar: registra la venta, descuenta inventario, imprime el ticket y limpia carrito, cliente y monto.
- El servidor recalcula el total, valida que haya existencias de cada producto (si falta uno, no descuenta nada y avisa) y rechaza montos inválidos.
- Si el usuario no tiene permiso de ventas, el botón de cobro se desactiva.
- El botón "Devoluciones" solo aparece en modo administrador.

**Ticket impreso**

- Ancho de 300 px en letra monoespaciada.
- Encabezado "ARISE Athletic Shop" con lema, número de ticket, fecha y hora, cliente, productos (cantidad o kg × precio = subtotal), total, pagado, cambio y pendiente.
- Aviso "⚠ VENTA CON CRÉDITO" cuando queda saldo.
- Pie "Gracias por su compra" (o "Venta con crédito pendiente") y "Conserve este ticket".

### 2.4 Historial de ventas, devoluciones y pérdidas (`/pos/ventas`, administrador)

**Pestaña Historial**

- Filtro de fecha: Todas, Hoy, Ayer, Esta semana (7 días), Este mes, Personalizado (desde/hasta, máximo hoy).
- Búsqueda por número de venta, cliente o producto.
- Orden por fecha o total, ascendente o descendente.
- Indicadores: número de ventas, monto total, promedio por venta y productos vendidos.
- Tarjetas desplegables con número, cantidad de productos, fecha, cliente, total y detalle.

**Editar ticket**

- Cambiar precio y cantidad (entero de 1 en adelante), quitar líneas (debe quedar al menos una) y agregar cualquier producto.
- Muestra lo pagado antes, el total nuevo y si "Se le debe al cliente", "El cliente nos debe" o "Cuenta saldada".
- Al guardar: regresa el inventario de la versión anterior, valida que haya stock para la nueva, descuenta, recalcula total, pendiente y estado (lo pagado no cambia). Si falla a la mitad, revierte todo. Completa el costo desde el producto si falta.
- Pregunta si se reimprime: "Ticket corregido #N" con la marca ARISE, con productos, total nuevo, pagado, saldo y lista de cambios (agregados, quitados, precio de X a Y, cantidad de X a Y).

**Pestaña Devoluciones**

- "Nueva devolución": venta de referencia (por defecto la más reciente), lista de todos los productos con su stock, cantidad a devolver y tipo "Se puede revender" o "Pérdida".
- Revendible regresa al inventario; pérdida no.
- Historial: número de devolución, venta, fecha y productos con su tipo.

**Pestaña Pérdidas**

- Tabla con fecha, venta, producto, cantidad y valor de la pérdida (cantidad × precio), con total.

### 2.5 Productos, inventario y categorías (`/pos/productos`)

- Vista en tabla o en tarjetas.
- Indicadores: total, activos y stock bajo (al hacer clic filtra solo stock bajo). Para administrador: valor del inventario a costo (costo × stock) y a precio de venta (precio × stock).
- Filtros: buscador (nombre, código, categoría), categoría, proveedor y orden por nombre, precio, stock o categoría, ascendente o descendente.
- Columnas: producto (código y etiqueta "A granel"), código, categoría, proveedor, precio ("/kg"), % de ganancia ((precio − costo) / costo), costo, stock / mínimo, estado y acciones (administrador).
- Semáforo de stock: rojo "Stock bajo" (igual o menor al mínimo), amarillo (hasta el doble del mínimo), verde (arriba).

**Formulario de producto (modo administrador o permiso "actualizar productos")**

- Nombre (obligatorio) y código de barras; si se deja vacío se genera con 10 dígitos.
- Categoría con opción de crear una nueva o borrar la actual (con confirmación).
- Proveedor o "Sin asignar".
- "Venta a granel (por peso)".
- Precio de compra (costo), precio de venta (obligatorio, no negativo), stock y stock mínimo. Decimales solo en granel; en piezas se usan enteros. Precios con 2 decimales.
- Estado: Activo o Inactivo (pasar a Inactivo requiere el permiso "dar de baja productos").
- Página promocional: descripción, imagen (archivo de hasta 1.5 MB o URL) con vista previa y "Quitar imagen", y "Mostrar como producto destacado".
- Eliminar producto con confirmación (requiere el permiso "borrar productos").
- Categorías sin duplicados (sin importar mayúsculas). Borrar una categoría no modifica los productos que la usan.
- **Exportar (administrador):** descarga todos los productos en CSV para Excel (código, nombre, categoría, precio, costo, stock, mínimo, estado, granel, destacado, descripción y proveedor).
- **Importar (administrador):** sube un CSV (separado por coma o punto y coma). Reconoce columnas en español con o sin acentos. Actualiza por código los productos existentes y crea los nuevos; al final muestra cuántos se crearon, cuántos se actualizaron y los errores por fila. Máximo 2000 productos por archivo.

### 2.6 Pedidos en línea (`/pos/pedidos`, administrador)

**Cuenta para transferencias**

- Formulario: titular, banco, número de cuenta, CLABE, tarjeta, WhatsApp (solo dígitos, con 52) y comisión de envío.
- "Guardar datos de cuenta": es lo que ve el cliente en la tienda. Solo cambia los campos enviados. Si un dato no se guarda en el POS, se toma de la configuración del servidor; ya no hay datos bancarios fijos en el código.

**Lista de pedidos**

- Pestañas con contador: Por verificar (pendientes y en revisión, predeterminada), Todos, Pagados y Rechazados.
- Botón "Actualizar"; también se recarga sola cuando hay avisos.
- Tarjeta: número, estado de pago, fecha, método, total, envío o recoger, nombre, teléfono, correo, dirección y referencias, productos, notas y miniatura del comprobante (se abre en pantalla completa).

**Acciones**

- "Confirmar pago y armar pedido" (pide confirmación, avisa que descontará inventario): marca pagado, pasa a confirmado, descuenta inventario y manda correo al cliente.
- "Rechazar" (pide motivo opcional): marca rechazado, cancela el pedido, regresa el inventario si ya se había descontado, agrega el motivo a las notas y manda correo al cliente.
- Pedido pagado: selector de estado (nuevo, confirmado, preparando, listo, entregado, cancelado). Cancelar regresa el inventario; reactivar un pedido pagado lo vuelve a descontar.
- Borrar un pedido regresa el inventario que se había descontado.

### 2.7 Avisos de pedidos en el POS

- Revisa pedidos cada 20 segundos y al regresar a la pestaña.
- La primera vez en un navegador solo toma referencia (no avisa de lo anterior).
- Avisa de "Nuevo pedido #N por transferencia" y "Comprobante recibido · pedido #N", con total y nombre del cliente.
- Mensajes en pantalla abajo a la derecha (hasta 4, se cierran solos a los 12 segundos), con enlace "Ver pedidos →" y botón ✕.
- Tono de 2 notas.
- Notificación del navegador (si hay permiso) que abre Pedidos al hacer clic.
- Botón "🔔 Activar avisos del navegador" mientras no se haya dado permiso.
- Contador fucsia en el menú con los pedidos por transferencia por verificar.
- Recuerda en el equipo qué pedidos ya avisó.
- Solo avisa de transferencias; los pagos con tarjeta llegan por correo.

### 2.8 Ofertas (`/pos/ofertas`, administrador)

- Tarjetas con imagen, "-X%", estado Activa/Inactiva, título, descripción, productos (+N más), precio de oferta y precio normal tachado.
- Botones Activar/Desactivar, Editar y Eliminar (con confirmación).
- "Nueva oferta": título (obligatorio), descripción, imagen (archivo de hasta 1.5 MB o URL), precio normal, precio de oferta, productos incluidos (lista con buscador y contador), válida desde, válida hasta y "Oferta activa (visible en la página promocional)".
- La tienda solo muestra las activas dentro de fecha (fechas vacías cuentan como abiertas).

### 2.9 Clientes (`/pos/clientes`)

- "Nuevo cliente": nombre (obligatorio), teléfono, correo y dirección.
- Buscador por nombre, teléfono o correo. Orden por total de compras, número de ventas o nombre.
- Tarjeta: datos de contacto, total comprado (oculto con •••••• sin modo administrador), número de ventas, última compra e insignia "Mejor cliente".
- Editar y eliminar (con confirmación).

### 2.10 Deudores (`/pos/deudores`)

- Clientes con ventas a crédito pendientes, ordenados por lo que deben.
- Indicadores: total de deudores, deuda total y ventas pendientes. Buscador.
- Detalle del cliente: contacto, "Debe $X" y cada venta con productos, total, "Dinero que dejó" y "Lo que no pagó".
- "Abonar": monto mayor a 0 y no mayor a lo pendiente; actualiza pagado, pendiente y estado. Al liquidar, el cliente sale de la lista.

### 2.11 Proveedores (`/pos/proveedores`)

- "Nuevo proveedor": nombre (obligatorio), teléfono, correo y dirección. Buscador.
- Tarjeta: total de deudas, total de pagos, saldo ("Debe $X" o "Sin deuda"), contacto y número de productos que surte.
- Eliminar con confirmación (los productos quedan sin proveedor).
- "Ver / Registrar deuda": saldo pendiente, total de deudas y pagos; formulario con tipo (deuda o pago), monto (mayor a 0, con separador de miles), fecha y descripción; historial de movimientos del más reciente al más antiguo.

### 2.12 Gastos Admin (`/pos/gastos-admin`, administrador)

- "Agregar gasto": fecha, descripción, categoría y monto (obligatorios).
- 11 categorías: Salud, Automotriz, Escuelas, Diversos, Sueldos, Viáticos, Entretenimiento, Servicios básicos de casa, Compras familiares, Seguros/Hacienda (SAT) y Gastos de la empresa.
- Indicadores del mes:
  - Ingresos = suma de lo pagado en ventas.
  - Costo de ventas = costo × cantidad, proporcional a lo pagado.
  - Gastos administrativos.
  - Ganancia neta = ingresos − costo − gastos (los gastos ya incluyen nóminas y adelantos en la categoría Sueldos, así que no se restan dos veces).
  - Efectivo disponible = ganancia neta.
- Alerta "Efectivo disponible bajo" si es negativo o hay gastos sin ingresos.
- Filtro por categoría y rango de fechas (por defecto el mes actual), con total filtrado.
- Gráfica de barras "Dónde se gasta más" por categoría con porcentaje.
- Tabla con fecha, descripción, categoría, monto, editar y eliminar.
- Selector "Resumen por periodo": diario (hoy), semanal (desde el lunes), mensual (desde el día 1), anual (desde el 1 de enero) o personalizado. Ajusta el rango Desde/Hasta; cambiar una fecha a mano lo pasa a personalizado.

### 2.13 Sueldos, adelantos y nómina (`/pos/sueldos`, administrador)

- Indicadores de los últimos 7 días: ingresos, costo de ventas, gastos, nóminas, ganancia neta y efectivo disponible; avisos "No hay empleados" y "No hay ingresos" y alerta de efectivo bajo.
- Trabajadores: nombre, puesto y sueldo semanal; editar y eliminar.
- Tabla: nombre, puesto, sueldo, adelanto pendiente y "Pagado esta semana" (semana de lunes a domingo).
- Chips de "Adelantos pendientes de descontar": nombre, saldo, descuento semanal y semanas.

**Procesar nómina**

- Botón con el total de sueldos. Solo lista trabajadores no pagados esa semana.
- Casilla por trabajador y días trabajados de 1 a 7 (7 por defecto).
- Sueldo bruto = sueldo × días / 7.
- Descuenta el adelanto semanal, solo a partir de la semana siguiente a cuando se dio, sin pasar del saldo ni del sueldo.
- Muestra el neto por trabajador y el total a pagar.
- Al guardar: actualiza el saldo de cada adelanto (lo marca liquidado al llegar a 0) y registra automáticamente el gasto "Nómina semanal (fecha)" en categoría Sueldos por el **neto** pagado (el servidor calcula el total).

**Adelanto de sueldo**

- Trabajador, monto a entregar hoy y semanas para descontarlo (1 a 52; 2 por defecto).
- Muestra "Total a entregar hoy" (sueldo + adelanto) y el descuento por semana.
- Al guardar registra el gasto "Adelanto de sueldo (nombre)" en categoría Sueldos (es dinero que sale ese día).
- Ganancia neta semanal = ingresos − costo − gastos (incluye sueldos).

**Calendario de pagos**

- Mes en cuadrícula de 6 semanas: punto verde = nómina, punto ámbar = adelanto.
- Al hacer clic en un día: detalle de nóminas (neto y descuento por trabajador) y adelantos entregados.

### 2.14 Reportes (`/pos/reportes`, administrador)

- Periodos: Hoy, Esta semana, Este mes, Este año (por defecto), Personalizado.
- Botones Actualizar, Exportar reporte y Ver historial.
- Métricas: total de ventas, ingresos, costo de productos, ganancia bruta, ganancia neta (menos gastos, que ya incluyen sueldos) y venta promedio.
- Resumen financiero: productos vendidos, margen de ganancia %, costo promedio por unidad y ganancia por venta.
- Tablas: 10 ventas más recientes del periodo y 10 productos más vendidos.
- Exportar CSV (abre en Excel con acentos): encabezado "Reporte de ventas - ARISE Athletic Shop", periodo, fecha de generación, métricas y 10 ventas recientes. Deshabilitado si no hay datos.
- Sin datos: botón "Ver todo el año" y enlace "Ir a ventas".

### 2.15 Deudas / metas de ahorro (`/pos/deudas`, administrador)

- "Metas de ahorro para pagos a largo plazo" con el total a ahorrar por día de todas las metas activas.
- Nueva meta: nombre, cantidad a reunir y fecha límite (por defecto un mes), con ahorro diario sugerido.
- Tarjeta: meta, ahorrado, fecha límite, ahorro diario ((meta − ahorrado) / días restantes sin contar los marcados "No"), días restantes y estado (completada o "Fecha pasada — ajusta la fecha").
- Calendario por meta: verde = ahorró, rojo = no ahorró, gris = sin marcar. Solo se pueden marcar días pasados u hoy, hasta la fecha límite. "¿Ahorraste este día?" Sí (registra el monto) o No (registra 0).
- Editar y eliminar meta (con confirmación).

### 2.16 Configuración (`/pos/configuracion`, administrador)

- Apariencia: tema oscuro o claro del POS (se recuerda en el equipo).
- Usuarios del sistema: tabla con nombre, correo, teléfono y permisos.
- Alta y edición: correo y contraseña (obligatorios, mínimo 6 caracteres; al editar, vacío = no cambia), nombre, teléfono y permisos: hacer ventas, dar de baja productos, actualizar productos y borrar productos (por defecto ventas y actualizar activados).
- El correo no se repite (también al editar), la contraseña se guarda cifrada (scrypt) y nunca se muestra. Las contraseñas antiguas se cifran solas en el siguiente inicio de sesión.
- Cada usuario entra al POS con su correo y contraseña.

---

## Anexo técnico

### Infraestructura

- Frontend: Next.js 14 (App Router), React 18, Tailwind CSS, Framer Motion, Three.js (React Three Fiber y Drei) para el 3D. Publicado en Vercel.
- Backend: Node.js con Express 4 y Mongoose 8. Publicado en Render.
- Base de datos: MongoDB Atlas.
- Librerías de pago y correo: Stripe, Mercado Pago y Nodemailer (Gmail).
- Repositorios en GitHub: frontend y backend por separado.

### Datos que guarda el sistema

| Colección | Qué guarda |
| --- | --- |
| Productos | Nombre, código, categoría, precio, costo, stock, stock mínimo, proveedor, imagen, descripción, granel, destacado, estado |
| Categorías | Nombre |
| Ventas | Fecha, productos, total, pagado, pendiente, cliente, estado |
| Pedidos | Productos, cliente, entrega, método, estados, comprobante, referencias de Stripe y Mercado Pago, notas |
| Clientes | Nombre, teléfono, correo, dirección |
| Proveedores | Nombre, teléfono, correo, dirección |
| Cuentas de proveedores | Deudas y pagos por proveedor |
| Ofertas | Título, descripción, imagen, precios, productos, fechas, activa |
| Devoluciones | Venta, productos, tipo (revendible o pérdida) |
| Empleados | Nombre, puesto, sueldo |
| Adelantos | Trabajador, monto, semanas, abono semanal, saldo, estado |
| Nóminas | Fecha, total, detalle por trabajador |
| Gastos | Fecha, descripción, categoría, monto |
| Metas de ahorro | Nombre, meta, fecha límite, estado |
| Registros de ahorro | Meta, día, monto |
| Usuarios | Correo, contraseña, nombre, teléfono, permisos |
| Configuración de pagos | Datos bancarios, WhatsApp, costo de envío |

### API del backend (`/api`)

| Módulo | Ruta | Operaciones |
| --- | --- | --- |
| Productos | /productos | Listar (filtro por proveedor), buscar por código, ver, crear, editar, borrar, importar CSV |
| Categorías | /categorias | Listar, crear, borrar |
| Ventas | /ventas | Listar, registrar, editar ticket, abonar |
| Devoluciones | /devoluciones | Listar, registrar, listar pérdidas |
| Clientes | /clientes | Listar, ver, crear, editar, borrar |
| Proveedores | /proveedores | Listar, ver, crear, editar, borrar |
| Cuentas de proveedores | /cuentas-proveedores | Resumen de saldos, movimientos por proveedor, registrar deuda o pago |
| Metas de ahorro | /deudas | Listar, crear, editar, borrar, registros diarios |
| Gastos | /gastos-admin | Listar, ver, crear, editar, borrar |
| Empleados | /empleados | Listar, ver, crear, editar, borrar |
| Adelantos | /adelantos | Listar (filtro por estado), por trabajador, crear |
| Nóminas | /nominas | Listar, registrar |
| Ofertas | /ofertas | Listar (solo activas opcional), ver, crear, editar, borrar |
| Pedidos | /pedidos | Listar (filtros y resumen ligero), ver, crear, editar, comprobante, verificar, rechazar, cambiar estado, borrar |
| Pagos | /pagos | Leer y guardar configuración, Stripe (cobro, confirmación, webhook), Mercado Pago (preferencia, confirmación, webhook) |
| Usuarios | /usuarios | Listar, ver, crear, editar, borrar |
| Acceso | /auth | Login (usuario principal o usuarios), sesión actual y modo administrador |
| Salud | /health | Comprobar que el servidor responde |

- Acepta cuerpos de hasta 12 MB (imágenes en base64).
- CORS: solo responde a las direcciones de la tienda en Vercel y a localhost.
- Cada registro usa un número consecutivo como identificador, asignado con un contador atómico (dos altas al mismo tiempo nunca repiten número).

**Acceso por ruta**

| Acceso | Rutas |
| --- | --- |
| Público | Catálogo, categorías y ofertas (lectura), crear pedido, configuración de pagos (lectura), pasarelas y webhooks, login |
| Público con token del pedido | Ver, editar, subir comprobante y pagar un pedido |
| Sesión del POS | Ventas (ver, abonar), clientes, proveedores, cuentas de proveedores, devoluciones (ver), resumen de pedidos |
| Según permiso | Vender, crear/editar/dar de baja/borrar productos, categorías |
| Modo administrador | Gastos, metas, empleados, nóminas, adelantos, usuarios, ofertas (cambios), pedidos (lista completa, verificar, rechazar, estado, borrar), editar ticket, devoluciones (registrar), configuración de pagos, importar productos |

### Variables de configuración del servidor

| Variable | Para qué sirve |
| --- | --- |
| PORT | Puerto del servidor (4000 por defecto) |
| MONGODB_URI | Conexión a la base de datos |
| FRONT_URL | Dirección de la tienda (CORS, enlaces de correos y regreso de pagos) |
| NODE_ENV | Modo producción |
| LOGIN_USER / LOGIN_PASSWORD | Usuario y contraseña del usuario principal del POS |
| AUTH_SECRET | Clave para firmar las sesiones (opcional; si falta se deriva de otros secretos) |
| ADMIN_PASSWORD | Contraseña del modo administrador |
| CURRENCY | Moneda de cobro (mxn por defecto) |
| STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY / STRIPE_WEBHOOK_SECRET | Stripe |
| MERCADOPAGO_ACCESS_TOKEN | Mercado Pago |
| MERCADOPAGO_WEBHOOK_SECRET | Verifica la firma de los avisos de Mercado Pago |
| PUBLIC_API_URL | Dirección pública del backend (avisos de Mercado Pago) |
| BANK_HOLDER / BANK_NAME / BANK_ACCOUNT / BANK_CLABE / BANK_CARD / WHATSAPP_NUMBER | Datos bancarios si no se guardan desde el POS |
| SMTP_USER / SMTP_PASS / NOTIFY_EMAIL | Correos automáticos |

Frontend: `NEXT_PUBLIC_API_URL` (dirección del backend) y `NEXT_PUBLIC_SITE_URL` (dirección pública de la tienda).

### Datos guardados en el navegador

- Carrito de la tienda.
- Tema claro u oscuro del POS.
- Pedidos ya avisados en el POS.
- Sesión del POS (token firmado de 12 horas).
- Sesión de modo administrador (solo mientras la pestaña esté abierta).

### Scripts de mantenimiento

- `seedDatosPrueba.js`: carga datos ficticios de ARISE (3 proveedores, 19 productos, 5 clientes, unos 30 días de ventas, 5 pedidos, 4 ofertas, 3 empleados, adelantos, nóminas, gastos, cuentas de proveedor, una meta de ahorro, un usuario y la configuración). Solo corre sobre la base "DidietMaldonado"; con `--reset` borra y vuelve a cargar.
- `eliminarLienzoCharro.js`: borra los gastos y movimientos del antiguo módulo Lienzo Charro (con `--confirmar`; sin él solo muestra qué borraría).

### Correcciones aplicadas (18 de octubre de 2026)

Todos los errores y funciones incompletas detectados en la revisión se corrigieron y se probaron (46 pruebas automáticas de punta a punta contra el servidor, más nómina y adelantos).

| Tema | Antes | Ahora |
| --- | --- | --- |
| Acceso al POS | Las páginas no pedían sesión | Sesión firmada de 12 horas; sin ella se regresa al login |
| Modo administrador | Solo se validaba en el navegador | El servidor entrega y valida una sesión de administrador |
| API | Cualquiera podía consultar o modificar | Cada ruta exige sesión, permiso o modo administrador (ver tabla de acceso) |
| Usuarios y permisos | Se guardaban sin aplicarse | Los usuarios entran con su correo y sus permisos se aplican en pantalla y en el servidor |
| Contraseñas de usuarios | Sin cifrar | Cifradas con scrypt; las anteriores se migran al iniciar sesión |
| Pedidos del cliente | Cualquiera podía ver un pedido por su número | Enlace con token secreto |
| Webhook de Mercado Pago | Sin verificación | Verifica la firma y que el monto cubra el total |
| Precios de pedidos | Los mandaba el navegador | Se toman del catálogo y de la configuración; se validan existencias |
| Ventas en caja | No validaban stock en el servidor | Validación atómica; si falta uno no se descuenta nada |
| Pedidos cancelados o borrados | No regresaban inventario | Rechazar, cancelar o borrar regresa el inventario |
| Venta sin monto pagado / nómina sin total | Quedaba un valor inválido | Se calcula en el servidor |
| Nómina | Gasto por el bruto y la ganancia neta restaba la nómina dos veces | Gasto por el neto, el adelanto se registra como gasto el día que se entrega y la ganancia ya no duplica sueldos |
| Números de registro | Podían repetirse | Contador atómico |
| Configuración de pagos | Guardar borraba los campos no enviados | Solo cambia lo enviado |
| Exportar / Importar productos | No hacían nada | Funcionan con CSV (ver 2.5) |
| Resumen por periodo (Gastos) | No hacía nada | Ajusta el rango de fechas |
| Envío en el carrito | "$10" fijo | Comisión real configurada |
| Regreso de Mercado Pago | No se leía | Se confirma el pago al regresar |
| Botones a páginas de administrador | Llevaban a una página bloqueada | Solo aparecen en modo administrador |
| Ticket y reporte CSV | "Punto de Venta / Juan Mejía" | ARISE Athletic Shop |
| Nombre interno del carrito | "nutri-ala-carrito" | "arise-carrito" (con migración) |
| Datos bancarios en el código | Precargados | Eliminados; se capturan en el POS |
| Edición de ticket | Si fallaba a la mitad podía descontar de más | Revierte todo |

### Pendiente (requiere información del cliente)

- **Datos bancarios para transferencias:** capturarlos en POS → Pedidos → "Cuenta para transferencias". Hoy la configuración guardada está vacía; hasta que se capturen, la tienda pide al cliente escribir por WhatsApp.
- **Logo e imagen de portada:** subir `arise-logo.png` y `hero-arise.jpg` a la carpeta `public/`.
- **Datos de contacto y redes:** teléfono, WhatsApp, correo, dirección, horarios e Instagram/Facebook/TikTok en `src/lib/tienda.ts`.
- **Variables recomendadas en Render:** `LOGIN_PASSWORD` y `ADMIN_PASSWORD` propias (no las de ejemplo), `AUTH_SECRET` y, si se usa Mercado Pago, `MERCADOPAGO_WEBHOOK_SECRET`.
