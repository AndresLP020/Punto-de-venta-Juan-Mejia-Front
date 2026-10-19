const BASE = process.env.NEXT_PUBLIC_API_URL || '';

// ============================================================
// SESIÓN DEL POS
// ============================================================

const TOKEN_KEY = 'arise-pos-token';
const ADMIN_TOKEN_KEY = 'arise-pos-admin-token';
const SESION_KEY = 'arise-pos-sesion';

export type PermisosSesion = {
  hacerVentas: boolean;
  darDeBajaProductos: boolean;
  actualizarProductos: boolean;
  borrarProductos: boolean;
};

export type Sesion = {
  usuario: string;
  nombre: string;
  rol: 'admin' | 'usuario';
  permisos: PermisosSesion;
  admin: boolean;
};

function leer(storage: 'local' | 'session', key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return (storage === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function escribir(storage: 'local' | 'session', key: string, value: string | null) {
  try {
    const st = storage === 'local' ? localStorage : sessionStorage;
    if (value == null) st.removeItem(key);
    else st.setItem(key, value);
  } catch {}
}

/** Token con el que se llama a la API: el de modo administrador si está activo. */
export function tokenActual(): string | null {
  return leer('session', ADMIN_TOKEN_KEY) || leer('local', TOKEN_KEY);
}

export function haySesion(): boolean {
  return Boolean(leer('local', TOKEN_KEY));
}

export function sesionGuardada(): Sesion | null {
  try {
    const raw = leer('local', SESION_KEY);
    return raw ? (JSON.parse(raw) as Sesion) : null;
  } catch {
    return null;
  }
}

export function hayTokenAdmin(): boolean {
  return Boolean(leer('session', ADMIN_TOKEN_KEY));
}

export function salirModoAdmin() {
  escribir('session', ADMIN_TOKEN_KEY, null);
}

export function cerrarSesion() {
  escribir('local', TOKEN_KEY, null);
  escribir('local', SESION_KEY, null);
  escribir('session', ADMIN_TOKEN_KEY, null);
}

async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = tokenActual();
  const headers = new Headers(init.headers);
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  // Sesión vencida o inválida dentro del POS: volver al login
  if (res.status === 401 && typeof window !== 'undefined' && window.location.pathname.startsWith('/pos')) {
    cerrarSesion();
    window.location.href = '/acceso';
  }
  return res;
}

/** Mensaje de error que manda el servidor, o uno por defecto */
async function mensajeError(res: Response, porDefecto: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string }).error || porDefecto;
}

/** Agrega el token secreto del pedido (enlace del cliente) a una URL */
const conToken = (url: string, t?: string | null) => (t ? `${url}${url.includes('?') ? '&' : '?'}t=${encodeURIComponent(t)}` : url);


export async function getProductos(proveedorId?: number) {
  const url = proveedorId != null ? `${BASE}/api/productos?proveedorId=${proveedorId}` : `${BASE}/api/productos`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar productos'));
  return res.json();
}

export async function getCategorias() {
  const res = await apiFetch(`${BASE}/api/categorias`);
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar categorías'));
  return res.json();
}

export async function postCategoria(nombre: string) {
  const res = await apiFetch(`${BASE}/api/categorias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: nombre.trim() }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al crear categoría');
  }
  return res.json();
}

export async function deleteCategoria(nombre: string) {
  const res = await apiFetch(`${BASE}/api/categorias/${encodeURIComponent(nombre)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al eliminar categoría');
  }
  return res.json();
}

export async function getProductoPorCodigo(codigo: string) {
  const res = await apiFetch(`${BASE}/api/productos/codigo/${codigo}`);
  if (!res.ok) throw new Error(await mensajeError(res, 'Producto no encontrado'));
  return res.json();
}

export async function getVentas() {
  const res = await apiFetch(`${BASE}/api/ventas`);
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar ventas'));
  return res.json();
}

export async function postVenta(body: { items: { id: number; nombre: string; precio: number; cantidad: number; costo?: number }[]; total: number; cliente?: string; clienteId?: number; pagado?: number }) {
  const res = await apiFetch(`${BASE}/api/ventas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al registrar venta'));
  return res.json();
}

export type VentaItemEdit = { id: number; nombre: string; precio: number; cantidad: number; costo?: number };

export async function putVenta(ventaId: number, body: { items: VentaItemEdit[] }) {
  const res = await apiFetch(`${BASE}/api/ventas/${ventaId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al actualizar venta');
  }
  return res.json();
}

export type DevolucionItem = { productoId: number; nombre: string; cantidad: number; precio: number; tipo: 'revendible' | 'perdida' };
export type Devolucion = { id: number; fecha: string; ventaId: number; items: DevolucionItem[] };
export type PerdidaItem = { id: number; fecha: string; ventaId: number; productoId: number; nombre: string; cantidad: number; precio: number; valorPerdida: number };

export async function getDevoluciones(): Promise<Devolucion[]> {
  const res = await apiFetch(`${BASE}/api/devoluciones`);
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar devoluciones'));
  return res.json();
}

export async function getPerdidas(): Promise<PerdidaItem[]> {
  const res = await apiFetch(`${BASE}/api/devoluciones/perdidas`);
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar pérdidas'));
  return res.json();
}

export async function postDevolucion(body: { ventaId?: number | null; items: { id: number; nombre: string; cantidad: number; precio: number; tipo: 'revendible' | 'perdida' }[] }) {
  const res = await apiFetch(`${BASE}/api/devoluciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al registrar devolución');
  }
  return res.json();
}

export async function abonarVenta(ventaId: number, monto: number) {
  const res = await apiFetch(`${BASE}/api/ventas/${ventaId}/abonar`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ monto }),
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al registrar abono'));
  return res.json();
}

export async function getClientes() {
  const res = await apiFetch(`${BASE}/api/clientes`);
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar clientes'));
  return res.json();
}

export async function postCliente(body: { nombre: string; telefono?: string; email?: string; direccion?: string }) {
  const res = await apiFetch(`${BASE}/api/clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al crear cliente'));
  return res.json();
}

export async function putCliente(id: number, body: { nombre?: string; telefono?: string; email?: string; direccion?: string }) {
  const res = await apiFetch(`${BASE}/api/clientes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al actualizar cliente'));
  return res.json();
}

export async function deleteCliente(id: number) {
  const res = await apiFetch(`${BASE}/api/clientes/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al eliminar cliente'));
}

// Proveedores
export type Proveedor = {
  id: number;
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
};

export async function getProveedores() {
  const res = await apiFetch(`${BASE}/api/proveedores`);
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar proveedores'));
  return res.json();
}

export async function postProveedor(body: { nombre: string; telefono?: string; email?: string; direccion?: string }) {
  const res = await apiFetch(`${BASE}/api/proveedores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al crear proveedor'));
  return res.json();
}

export async function putProveedor(id: number, body: { nombre?: string; telefono?: string; email?: string; direccion?: string }) {
  const res = await apiFetch(`${BASE}/api/proveedores/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al actualizar proveedor'));
  return res.json();
}

export async function deleteProveedor(id: number) {
  const res = await apiFetch(`${BASE}/api/proveedores/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al eliminar proveedor'));
}

// Cuentas con proveedores (deudas y pagos)
export type CuentaProveedorResumen = {
  proveedorId: number;
  proveedorNombre: string;
  totalDeuda: number;
  totalPagos: number;
  saldoPendiente: number;
};

export type MovimientoCuentaProveedor = {
  id: number;
  proveedorId: number;
  proveedorNombre: string;
  tipo: 'deuda' | 'pago';
  fecha: string;
  descripcion: string;
  monto: number;
};

export async function getCuentasProveedoresResumen(): Promise<CuentaProveedorResumen[]> {
  const res = await apiFetch(`${BASE}/api/cuentas-proveedores`);
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar cuentas de proveedores'));
  return res.json();
}

export async function getMovimientosProveedor(proveedorId: number): Promise<MovimientoCuentaProveedor[]> {
  const res = await apiFetch(`${BASE}/api/cuentas-proveedores/${proveedorId}`);
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar movimientos del proveedor'));
  return res.json();
}

export async function postMovimientoProveedor(body: {
  proveedorId: number;
  tipo: 'deuda' | 'pago';
  monto: number;
  descripcion?: string;
  fecha?: string;
}): Promise<MovimientoCuentaProveedor> {
  const res = await apiFetch(`${BASE}/api/cuentas-proveedores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al registrar movimiento con proveedor');
  }
  return res.json();
}

export async function postProducto(body: { nombre: string; codigo?: string; categoria: string; precio: number; costo?: number; stock?: number; stockMinimo?: number; estado?: string; esGranel?: boolean; proveedorId?: number; descripcion?: string; imagen?: string; destacado?: boolean }) {
  const res = await apiFetch(`${BASE}/api/productos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al crear producto'));
  return res.json();
}

export async function putProducto(id: number, body: { nombre?: string; codigo?: string; categoria?: string; precio?: number; costo?: number; stock?: number; stockMinimo?: number; estado?: string; esGranel?: boolean; proveedorId?: number | null; descripcion?: string; imagen?: string; destacado?: boolean }) {
  const res = await apiFetch(`${BASE}/api/productos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al actualizar producto'));
  return res.json();
}

export async function deleteProducto(id: number) {
  const res = await apiFetch(`${BASE}/api/productos/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al eliminar producto'));
}

export type Producto = {
  id: number;
  nombre: string;
  codigo?: string;
  categoria: string;
  precio: number;
  costo?: number;
  stock: number;
  stockMinimo?: number;
  estado?: string;
  /** Si true, el producto se vende por peso (kg). Precio = precio por kg, stock = stock en kg */
  esGranel?: boolean;
  proveedorId?: number;
  /** Descripción para la página promocional */
  descripcion?: string;
  /** Imagen del producto (URL o data URL base64) */
  imagen?: string;
  /** Si true, aparece destacado en la página promocional */
  destacado?: boolean;
};

// Ofertas (para la página promocional)
export type Oferta = {
  id: number;
  titulo: string;
  descripcion?: string;
  imagen?: string;
  precioNormal?: number;
  precioOferta?: number;
  productos?: string[];
  activa?: boolean;
  fechaInicio?: string;
  fechaFin?: string;
  creadaEn?: string;
};

export async function getOfertas(soloActivas = false): Promise<Oferta[]> {
  const url = soloActivas ? `${BASE}/api/ofertas?soloActivas=1` : `${BASE}/api/ofertas`;
  const res = await apiFetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar ofertas'));
  return res.json();
}

export async function postOferta(body: {
  titulo: string;
  descripcion?: string;
  imagen?: string;
  precioNormal?: number;
  precioOferta?: number;
  productos?: string[];
  activa?: boolean;
  fechaInicio?: string;
  fechaFin?: string;
}): Promise<Oferta> {
  const res = await apiFetch(`${BASE}/api/ofertas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al crear oferta');
  }
  return res.json();
}

export async function putOferta(
  id: number,
  body: {
    titulo?: string;
    descripcion?: string;
    imagen?: string;
    precioNormal?: number;
    precioOferta?: number;
    productos?: string[];
    activa?: boolean;
    fechaInicio?: string;
    fechaFin?: string;
  }
): Promise<Oferta> {
  const res = await apiFetch(`${BASE}/api/ofertas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al actualizar oferta');
  }
  return res.json();
}

export async function deleteOferta(id: number): Promise<void> {
  const res = await apiFetch(`${BASE}/api/ofertas/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al eliminar oferta'));
}

export type Cliente = {
  id: number;
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
};

// Gastos Administrativos
export type GastoAdmin = {
  id: number;
  fecha: string;
  descripcion: string;
  categoria: string;
  monto: number;
};

export const CATEGORIAS_GASTOS = [
  'Salud',
  'Automotriz',
  'Escuelas',
  'Diversos',
  'Sueldos',
  'Viáticos',
  'Entretenimiento',
  'Servicios básicos de casa',
  'Compras familiares',
  'seguros, Hacienda (SAT)',
  'Gastos de la empresa',
] as const;

export async function getGastosAdmin() {
  const res = await apiFetch(`${BASE}/api/gastos-admin`);
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar gastos'));
  return res.json();
}

export async function postGastoAdmin(body: { fecha?: string; descripcion: string; categoria: string; monto: number }) {
  const res = await apiFetch(`${BASE}/api/gastos-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al registrar gasto'));
  return res.json();
}

export async function putGastoAdmin(id: number, body: { fecha?: string; descripcion?: string; categoria?: string; monto?: number }) {
  const res = await apiFetch(`${BASE}/api/gastos-admin/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al actualizar gasto'));
  return res.json();
}

export async function deleteGastoAdmin(id: number) {
  const res = await apiFetch(`${BASE}/api/gastos-admin/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al eliminar gasto'));
}

// Metas de ahorro (Deudas / objetivos de ahorro)
export type MetaAhorro = {
  id: number;
  nombre: string;
  meta: number;
  fechaLimite: string;
  estado: string;
};

export async function getMetasAhorro() {
  const res = await apiFetch(`${BASE}/api/deudas`);
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar metas de ahorro'));
  return res.json();
}

export async function postMetaAhorro(body: { nombre: string; meta: number; fechaLimite: string }) {
  const res = await apiFetch(`${BASE}/api/deudas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al crear meta de ahorro');
  }
  return res.json();
}

export async function putMetaAhorro(id: number, body: { nombre?: string; meta?: number; fechaLimite?: string; estado?: string }) {
  const res = await apiFetch(`${BASE}/api/deudas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al actualizar meta de ahorro');
  }
  return res.json();
}

export async function deleteMetaAhorro(id: number) {
  const res = await apiFetch(`${BASE}/api/deudas/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al eliminar meta de ahorro');
  }
}

export type RegistroAhorroDia = { fecha: string; monto: number };

export async function getRegistrosAhorro(metaId: number): Promise<RegistroAhorroDia[]> {
  const res = await apiFetch(`${BASE}/api/deudas/${metaId}/registros`);
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar registros'));
  return res.json();
}

export async function putRegistroDia(metaId: number, fecha: string, monto: number): Promise<RegistroAhorroDia> {
  const res = await apiFetch(`${BASE}/api/deudas/${metaId}/dias`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fecha: fecha.slice(0, 10), monto }),
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al guardar día'));
  return res.json();
}

// Empleados (trabajadores) y nóminas
export type Empleado = {
  id: number;
  nombre: string;
  sueldo: number;
  puesto?: string;
};

export type Nomina = {
  id: number;
  fecha: string;
  items: { empleadoId: number; nombre: string; monto: number; diasTrabajados?: number; semana?: string; adelantoDescontado?: number }[];
  total: number;
};

export async function getEmpleados() {
  const res = await apiFetch(`${BASE}/api/empleados`);
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar empleados'));
  return res.json();
}

export async function postEmpleado(body: { nombre: string; sueldo: number; puesto?: string }) {
  const res = await apiFetch(`${BASE}/api/empleados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al crear empleado'));
  return res.json();
}

export async function putEmpleado(id: number, body: { nombre?: string; sueldo?: number; puesto?: string }) {
  const res = await apiFetch(`${BASE}/api/empleados/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al actualizar empleado'));
  return res.json();
}

export async function deleteEmpleado(id: number) {
  const res = await apiFetch(`${BASE}/api/empleados/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al eliminar empleado'));
}

export async function getNominas() {
  const res = await apiFetch(`${BASE}/api/nominas`);
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar nóminas'));
  return res.json();
}

// Adelantos de sueldo (se descuentan en las siguientes nóminas)
export type Adelanto = {
  id: number;
  empleadoId: number;
  nombre: string;
  montoTotal: number;
  semanas: number;
  montoPorSemana: number;
  saldoPendiente: number;
  fecha: string;
  estado: 'activo' | 'liquidado';
};

export async function getAdelantos(estado?: 'activo' | 'liquidado') {
  const url = estado ? `${BASE}/api/adelantos?estado=${estado}` : `${BASE}/api/adelantos`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar adelantos'));
  return res.json();
}

export async function postAdelanto(body: { empleadoId: number; montoTotal: number; semanas: number }) {
  const res = await apiFetch(`${BASE}/api/adelantos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al registrar adelanto'));
  return res.json();
}

export async function postNomina(body: {
  items: { empleadoId: number; nombre: string; monto: number; diasTrabajados?: number; semana?: string }[];
  total?: number;
  fecha?: string;
}) {
  const res = await apiFetch(`${BASE}/api/nominas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al procesar nómina'));
  return res.json();
}

// Usuarios del sistema (configuración)
export type PermisosPOS = {
  hacerVentas: boolean;
  darDeBajaProductos: boolean;
  actualizarProductos: boolean;
  borrarProductos: boolean;
};

export type Usuario = {
  id: number;
  email: string;
  nombre: string;
  telefono?: string;
  permisos: PermisosPOS;
};

export async function getUsuarios() {
  const res = await apiFetch(`${BASE}/api/usuarios`);
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar usuarios'));
  return res.json();
}

export async function postUsuario(body: {
  email: string;
  password: string;
  nombre: string;
  telefono?: string;
  permisos?: PermisosPOS;
}) {
  const res = await apiFetch(`${BASE}/api/usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error al crear usuario');
  }
  return res.json();
}

export async function putUsuario(
  id: number,
  body: { email?: string; password?: string; nombre?: string; telefono?: string; permisos?: PermisosPOS }
) {
  const res = await apiFetch(`${BASE}/api/usuarios/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al actualizar usuario'));
  return res.json();
}

export async function deleteUsuario(id: number) {
  const res = await apiFetch(`${BASE}/api/usuarios/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al eliminar usuario'));
}

export async function login(usuario: string, password: string): Promise<Sesion> {
  cerrarSesion();
  const res = await apiFetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: usuario.trim(), password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Usuario o contraseña incorrectos');
  }
  const data = (await res.json()) as { token: string; sesion: Sesion };
  escribir('local', TOKEN_KEY, data.token);
  escribir('local', SESION_KEY, JSON.stringify(data.sesion));
  return data.sesion;
}

/** Valida la sesión guardada con el servidor (null si venció) */
export async function getSesion(): Promise<Sesion | null> {
  if (!haySesion()) return null;
  const res = await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${tokenActual()}` }, cache: 'no-store' });
  if (res.status === 401) {
    // Puede haber vencido solo el token de administrador: probar con el de la sesión normal
    if (hayTokenAdmin()) {
      salirModoAdmin();
      return getSesion();
    }
    cerrarSesion();
    return null;
  }
  if (!res.ok) return sesionGuardada();
  const s = (await res.json()) as Sesion;
  escribir('local', SESION_KEY, JSON.stringify({ ...s, admin: false }));
  return s;
}

export async function verifyAdminPassword(password: string): Promise<{ ok: true }> {
  const res = await apiFetch(`${BASE}/api/auth/verify-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Contraseña incorrecta');
  }
  const data = (await res.json()) as { token: string };
  escribir('session', ADMIN_TOKEN_KEY, data.token);
  return { ok: true };
}

// ============================================================
// PEDIDOS ONLINE Y PAGOS (carrito de la página promocional)
// ============================================================

export type MetodoPago = 'efectivo' | 'transferencia' | 'stripe' | 'mercadopago';
export type EstadoPago = 'pendiente' | 'en_revision' | 'pagado' | 'rechazado';
export type EstadoPedido = 'nuevo' | 'confirmado' | 'preparando' | 'listo' | 'entregado' | 'cancelado';
export type TipoEntrega = 'pickup' | 'envio';

export type PedidoItem = {
  id: number;
  nombre: string;
  precio: number;
  cantidad: number;
  costo?: number;
  esGranel?: boolean;
  imagen?: string;
};

export type PedidoCliente = {
  nombre: string;
  telefono: string;
  email?: string;
  direccion?: string;
  referencias?: string;
};

export type Pedido = {
  id: number;
  fecha: string;
  items: PedidoItem[];
  subtotal: number;
  envio: number;
  total: number;
  cliente: PedidoCliente;
  entrega: TipoEntrega;
  metodoPago: MetodoPago;
  estadoPago: EstadoPago;
  estadoPedido: EstadoPedido;
  comprobante?: string;
  notas?: string;
  stripeSessionId?: string;
  mpPreferenceId?: string;
  creadoEn?: string;
  actualizadoEn?: string;
  /** Token secreto del enlace del pedido */
  token?: string;
};

export type PagosConfig = {
  currency: string;
  metodos: { efectivo: boolean; transferencia: boolean; stripe: boolean; mercadopago: boolean };
  stripePublishableKey: string;
  stripePendienteActivacion?: boolean;
  banco: { titular: string; banco: string; cuenta: string; clabe: string; tarjeta: string };
  whatsapp: string;
  costoEnvio: number;
};

export async function getPagosConfig(): Promise<PagosConfig> {
  const res = await apiFetch(`${BASE}/api/pagos/config`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar configuración de pagos'));
  return res.json();
}

export async function putPagosConfig(body: PagosConfig['banco'] & { whatsapp?: string; costoEnvio?: number }): Promise<PagosConfig['banco'] & { whatsapp?: string; costoEnvio?: number }> {
  const res = await apiFetch(`${BASE}/api/pagos/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al guardar los datos bancarios');
  }
  return res.json();
}

export async function getPedidos(filtros?: {
  estadoPago?: EstadoPago;
  estadoPedido?: EstadoPedido;
  metodoPago?: MetodoPago;
}): Promise<Pedido[]> {
  const qs = new URLSearchParams();
  if (filtros?.estadoPago) qs.set('estadoPago', filtros.estadoPago);
  if (filtros?.estadoPedido) qs.set('estadoPedido', filtros.estadoPedido);
  if (filtros?.metodoPago) qs.set('metodoPago', filtros.metodoPago);
  const q = qs.toString();
  const res = await apiFetch(`${BASE}/api/pedidos${q ? `?${q}` : ''}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar pedidos'));
  return res.json();
}

/** Versión ligera de los pedidos (sin imagen de comprobante) para los avisos del POS */
export type PedidoResumen = Pick<Pedido, 'id' | 'fecha' | 'total' | 'metodoPago' | 'estadoPago' | 'estadoPedido'> & {
  cliente?: { nombre?: string };
  tieneComprobante: boolean;
};

export async function getPedidosResumen(): Promise<PedidoResumen[]> {
  const res = await apiFetch(`${BASE}/api/pedidos?resumen=1`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await mensajeError(res, 'Error al cargar pedidos'));
  return res.json();
}

export async function getPedido(id: number, t?: string | null): Promise<Pedido> {
  const res = await apiFetch(conToken(`${BASE}/api/pedidos/${id}`, t), { cache: 'no-store' });
  if (!res.ok) throw new Error(await mensajeError(res, 'Pedido no encontrado'));
  return res.json();
}

export async function postPedido(body: {
  items: PedidoItem[];
  cliente: PedidoCliente;
  entrega: TipoEntrega;
  metodoPago: MetodoPago;
  envio?: number;
  notas?: string;
}): Promise<Pedido> {
  const res = await apiFetch(`${BASE}/api/pedidos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al crear el pedido');
  }
  return res.json();
}

export async function putPedidoCheckout(
  id: number,
  body: {
    items: PedidoItem[];
    cliente: PedidoCliente;
    entrega: TipoEntrega;
    metodoPago: MetodoPago;
    envio?: number;
    notas?: string;
  },
  t?: string | null
): Promise<Pedido> {
  const res = await apiFetch(conToken(`${BASE}/api/pedidos/${id}/checkout`, t), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al actualizar el pedido');
  }
  return res.json();
}

export async function subirComprobante(id: number, comprobante: string, t?: string | null): Promise<Pedido> {
  const res = await apiFetch(conToken(`${BASE}/api/pedidos/${id}/comprobante`, t), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comprobante }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al subir el comprobante');
  }
  return res.json();
}

export async function verificarPedido(id: number): Promise<Pedido> {
  const res = await apiFetch(`${BASE}/api/pedidos/${id}/verificar`, { method: 'PUT' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al confirmar el pago');
  }
  return res.json();
}

export async function rechazarPedido(id: number, motivo?: string): Promise<Pedido> {
  const res = await apiFetch(`${BASE}/api/pedidos/${id}/rechazar`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo: motivo || '' }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al rechazar el pedido');
  }
  return res.json();
}

export async function actualizarEstadoPedido(id: number, estadoPedido: EstadoPedido): Promise<Pedido> {
  const res = await apiFetch(`${BASE}/api/pedidos/${id}/estado`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estadoPedido }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al actualizar el estado');
  }
  return res.json();
}

export async function crearStripeCheckout(pedidoId: number, t?: string | null): Promise<{ url: string }> {
  const res = await apiFetch(conToken(`${BASE}/api/pagos/stripe/checkout`, t), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pedidoId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al iniciar el pago con Stripe');
  }
  return res.json();
}

export async function confirmarStripePago(pedidoId: number, t?: string | null): Promise<Pedido> {
  const res = await apiFetch(conToken(`${BASE}/api/pagos/stripe/confirmar`, t), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pedidoId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al confirmar el pago con Stripe');
  }
  return res.json();
}

export async function crearMercadoPagoPreference(pedidoId: number, t?: string | null): Promise<{ init_point: string; preferenceId: string }> {
  const res = await apiFetch(conToken(`${BASE}/api/pagos/mercadopago/preference`, t), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pedidoId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al iniciar el pago con Mercado Pago');
  }
  return res.json();
}

/** El cliente regresa de Mercado Pago: confirma el pago sin esperar al webhook */
export async function confirmarMercadoPago(pedidoId: number, paymentId: string, t?: string | null): Promise<Pedido> {
  const res = await apiFetch(conToken(`${BASE}/api/pagos/mercadopago/confirmar`, t), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pedidoId, paymentId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al confirmar el pago con Mercado Pago');
  }
  return res.json();
}

/** Importa productos desde un CSV ya convertido a filas (actualiza por código o crea) */
export async function importarProductos(
  productos: Record<string, string>[]
): Promise<{ creados: number; actualizados: number; errores: string[] }> {
  const res = await apiFetch(`${BASE}/api/productos/importar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productos }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al importar productos');
  }
  return res.json();
}
