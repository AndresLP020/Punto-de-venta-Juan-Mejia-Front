const BASE = process.env.NEXT_PUBLIC_API_URL || '';

// ---------------------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'pos-token';
const USUARIO_KEY = 'pos-usuario';
const ADMIN_TOKEN_KEY = 'pos-admin-token';

export type PermisosPOS = {
  hacerVentas: boolean;
  darDeBajaProductos: boolean;
  actualizarProductos: boolean;
  borrarProductos: boolean;
};

export type UsuarioSesion = {
  nombre: string;
  email: string;
  principal: boolean;
  permisos: PermisosPOS;
};

function leer(storage: 'local' | 'session', key: string): string | null {
  try {
    return (storage === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function escribir(storage: 'local' | 'session', key: string, value: string | null) {
  try {
    const s = storage === 'local' ? localStorage : sessionStorage;
    if (value == null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {}
}

export function getToken(): string | null {
  return leer('session', ADMIN_TOKEN_KEY) || leer('local', TOKEN_KEY);
}

export function haySesion(): boolean {
  return Boolean(leer('local', TOKEN_KEY));
}

export function getUsuarioSesion(): UsuarioSesion | null {
  const raw = leer('local', USUARIO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UsuarioSesion;
  } catch {
    return null;
  }
}

export function tieneAdminToken(): boolean {
  return Boolean(leer('session', ADMIN_TOKEN_KEY));
}

export function setAdminToken(token: string | null) {
  escribir('session', ADMIN_TOKEN_KEY, token);
}

export function cerrarSesion() {
  escribir('local', TOKEN_KEY, null);
  escribir('local', USUARIO_KEY, null);
  escribir('session', ADMIN_TOKEN_KEY, null);
}

/** Error de la API con el código HTTP. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T = unknown>(path: string, options: { method?: string; body?: unknown; fallback?: string } = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      // Sesión vencida o inválida: volver al inicio de sesión.
      cerrarSesion();
      if (typeof window !== 'undefined' && window.location.pathname !== '/') window.location.href = '/';
    }
    if (res.status === 403 && /modo administrador/i.test(data.error || '')) {
      // El token de administrador expiró: salir del modo administrador.
      setAdminToken(null);
    }
    throw new ApiError(res.status, data.error || options.fallback || 'Error de conexión con el servidor');
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const get = <T = any>(path: string, fallback?: string) => request<T>(path, { fallback });
const send = <T = any>(method: string, path: string, body?: unknown, fallback?: string) => request<T>(path, { method, body, fallback });

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------

export async function login(usuario: string, password: string): Promise<UsuarioSesion> {
  const data = await send<{ token: string; usuario: UsuarioSesion }>('POST', '/api/auth/login', { usuario: usuario.trim(), password }, 'Usuario o contraseña incorrectos');
  cerrarSesion();
  escribir('local', TOKEN_KEY, data.token);
  escribir('local', USUARIO_KEY, JSON.stringify(data.usuario));
  return data.usuario;
}

export async function verifyAdminPassword(password: string): Promise<{ ok: true }> {
  const data = await send<{ token: string }>('POST', '/api/auth/verify-admin', { password }, 'Contraseña incorrecta');
  setAdminToken(data.token);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Productos y categorías
// ---------------------------------------------------------------------------

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
};

export const getProductos = (proveedorId?: number) =>
  get(proveedorId != null ? `/api/productos?proveedorId=${proveedorId}` : '/api/productos', 'Error al cargar productos');

export const getCategorias = () => get('/api/categorias', 'Error al cargar categorías');

export const postCategoria = (nombre: string) => send('POST', '/api/categorias', { nombre: nombre.trim() }, 'Error al crear categoría');

export const deleteCategoria = (nombre: string) => send('DELETE', `/api/categorias/${encodeURIComponent(nombre)}`, undefined, 'Error al eliminar categoría');

export const getProductoPorCodigo = (codigo: string) => get(`/api/productos/codigo/${encodeURIComponent(codigo)}`, 'Producto no encontrado');

export const postProducto = (body: { nombre: string; codigo?: string; categoria: string; precio: number; costo?: number; stock?: number; stockMinimo?: number; estado?: string; esGranel?: boolean; proveedorId?: number }) =>
  send('POST', '/api/productos', body, 'Error al crear producto');

export const putProducto = (id: number, body: { nombre?: string; codigo?: string; categoria?: string; precio?: number; costo?: number; stock?: number; stockMinimo?: number; estado?: string; esGranel?: boolean; proveedorId?: number | null }) =>
  send('PUT', `/api/productos/${id}`, body, 'Error al actualizar producto');

export const deleteProducto = (id: number) => send<void>('DELETE', `/api/productos/${id}`, undefined, 'Error al eliminar producto');

// ---------------------------------------------------------------------------
// Ventas, abonos y devoluciones
// ---------------------------------------------------------------------------

export type MovimientoVenta = { fecha: string; monto: number; motivo?: string };

export type Venta = {
  id: number;
  fecha: string;
  items: { id: number; nombre: string; precio: number; cantidad: number; costo?: number }[];
  total: number;
  pagado?: number;
  pendiente?: number;
  cliente?: string;
  clienteId?: number;
  estado?: 'pagado' | 'pendiente' | 'cancelada' | string;
  abonos?: MovimientoVenta[];
  reembolsos?: MovimientoVenta[];
  fechaCancelacion?: string;
};

export const getVentas = (): Promise<Venta[]> => get('/api/ventas', 'Error al cargar ventas');

export const postVenta = (body: { items: { id: number; nombre: string; precio: number; cantidad: number; costo?: number }[]; total: number; cliente?: string; clienteId?: number; pagado?: number }) =>
  send<Venta & { cambio: number }>('POST', '/api/ventas', body, 'Error al registrar venta');

export type VentaItemEdit = { id: number; nombre: string; precio: number; cantidad: number; costo?: number };

export const putVenta = (ventaId: number, body: { items: VentaItemEdit[] }) =>
  send<Venta & { reembolso: number }>('PUT', `/api/ventas/${ventaId}`, body, 'Error al actualizar venta');

export const cancelarVenta = (ventaId: number) => send<Venta>('POST', `/api/ventas/${ventaId}/cancelar`, undefined, 'Error al cancelar la venta');

export const abonarVenta = (ventaId: number, monto: number) => send<Venta>('PUT', `/api/ventas/${ventaId}/abonar`, { monto }, 'Error al registrar abono');

export type DevolucionItem = { productoId: number; nombre: string; cantidad: number; precio: number; costo?: number; tipo: 'revendible' | 'perdida' };
export type Devolucion = { id: number; fecha: string; ventaId: number; items: DevolucionItem[]; reembolso?: number; ajusteCosto?: number };
export type PerdidaItem = { id: number; fecha: string; ventaId: number; productoId: number; nombre: string; cantidad: number; precio: number; valorPerdida: number; costo?: number; costoPerdida?: number };

export const getDevoluciones = (): Promise<Devolucion[]> => get('/api/devoluciones', 'Error al cargar devoluciones');

export const getPerdidas = (): Promise<PerdidaItem[]> => get('/api/devoluciones/perdidas', 'Error al cargar pérdidas');

export const postDevolucion = (body: { ventaId?: number | null; items: { id: number; nombre: string; cantidad: number; precio: number; tipo: 'revendible' | 'perdida' }[] }) =>
  send<Devolucion>('POST', '/api/devoluciones', body, 'Error al registrar devolución');

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export type Cliente = {
  id: number;
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
};

export const getClientes = () => get('/api/clientes', 'Error al cargar clientes');

export const postCliente = (body: { nombre: string; telefono?: string; email?: string; direccion?: string }) => send('POST', '/api/clientes', body, 'Error al crear cliente');

export const putCliente = (id: number, body: { nombre?: string; telefono?: string; email?: string; direccion?: string }) =>
  send('PUT', `/api/clientes/${id}`, body, 'Error al actualizar cliente');

export const deleteCliente = (id: number) => send<void>('DELETE', `/api/clientes/${id}`, undefined, 'Error al eliminar cliente');

// ---------------------------------------------------------------------------
// Proveedores y cuentas con proveedores
// ---------------------------------------------------------------------------

export type Proveedor = {
  id: number;
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
};

export const getProveedores = () => get('/api/proveedores', 'Error al cargar proveedores');

export const postProveedor = (body: { nombre: string; telefono?: string; email?: string; direccion?: string }) => send('POST', '/api/proveedores', body, 'Error al crear proveedor');

export const putProveedor = (id: number, body: { nombre?: string; telefono?: string; email?: string; direccion?: string }) =>
  send('PUT', `/api/proveedores/${id}`, body, 'Error al actualizar proveedor');

export const deleteProveedor = (id: number) => send<void>('DELETE', `/api/proveedores/${id}`, undefined, 'Error al eliminar proveedor');

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

export const getCuentasProveedoresResumen = (): Promise<CuentaProveedorResumen[]> => get('/api/cuentas-proveedores', 'Error al cargar cuentas de proveedores');

export const getMovimientosProveedor = (proveedorId: number): Promise<MovimientoCuentaProveedor[]> =>
  get(`/api/cuentas-proveedores/${proveedorId}`, 'Error al cargar movimientos del proveedor');

export const postMovimientoProveedor = (body: { proveedorId: number; tipo: 'deuda' | 'pago'; monto: number; descripcion?: string; fecha?: string }): Promise<MovimientoCuentaProveedor> =>
  send('POST', '/api/cuentas-proveedores', body, 'Error al registrar movimiento con proveedor');

export const deleteMovimientoProveedor = (id: number) => send<void>('DELETE', `/api/cuentas-proveedores/movimiento/${id}`, undefined, 'Error al eliminar movimiento');

// ---------------------------------------------------------------------------
// Lienzo Charro: ingresos (renta caballos) y gastos (mantención)
// ---------------------------------------------------------------------------

export type MovimientoLienzo = {
  id: number;
  fecha: string;
  tipo: 'ingreso' | 'gasto';
  descripcion: string;
  monto: number;
};

export const getMovimientosLienzo = (): Promise<MovimientoLienzo[]> => get('/api/lienzo-charro', 'Error al cargar movimientos Lienzo Charro');

export const postMovimientoLienzo = (body: { fecha?: string; tipo: 'ingreso' | 'gasto'; descripcion?: string; monto: number }): Promise<MovimientoLienzo> =>
  send('POST', '/api/lienzo-charro', body, 'Error al registrar movimiento');

export const deleteMovimientoLienzo = (id: number): Promise<void> => send('DELETE', `/api/lienzo-charro/${id}`, undefined, 'Error al eliminar movimiento');

// ---------------------------------------------------------------------------
// Gastos Administrativos
// ---------------------------------------------------------------------------

export type GastoAdmin = {
  id: number;
  fecha: string;
  descripcion: string;
  categoria: string;
  monto: number;
  /** Generado automáticamente desde una nómina o desde Lienzo Charro (no se edita aquí). */
  nominaId?: number;
  lienzoId?: number;
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
  'Lienzo Charro',
  'Gastos de la empresa',
] as const;

export const getGastosAdmin = () => get('/api/gastos-admin', 'Error al cargar gastos');

export const postGastoAdmin = (body: { fecha?: string; descripcion: string; categoria: string; monto: number }) => send('POST', '/api/gastos-admin', body, 'Error al registrar gasto');

export const putGastoAdmin = (id: number, body: { fecha?: string; descripcion?: string; categoria?: string; monto?: number }) =>
  send('PUT', `/api/gastos-admin/${id}`, body, 'Error al actualizar gasto');

export const deleteGastoAdmin = (id: number) => send<void>('DELETE', `/api/gastos-admin/${id}`, undefined, 'Error al eliminar gasto');

// ---------------------------------------------------------------------------
// Metas de ahorro (Deudas / objetivos de ahorro)
// ---------------------------------------------------------------------------

export type MetaAhorro = {
  id: number;
  nombre: string;
  meta: number;
  fechaLimite: string;
  estado: string;
};

export const getMetasAhorro = () => get('/api/deudas', 'Error al cargar metas de ahorro');

export const postMetaAhorro = (body: { nombre: string; meta: number; fechaLimite: string }) => send('POST', '/api/deudas', body, 'Error al crear meta de ahorro');

export const putMetaAhorro = (id: number, body: { nombre?: string; meta?: number; fechaLimite?: string; estado?: string }) =>
  send('PUT', `/api/deudas/${id}`, body, 'Error al actualizar meta de ahorro');

export const deleteMetaAhorro = (id: number) => send<void>('DELETE', `/api/deudas/${id}`, undefined, 'Error al eliminar meta de ahorro');

export type RegistroAhorroDia = { fecha: string; monto: number };

export const getRegistrosAhorro = (metaId: number): Promise<RegistroAhorroDia[]> => get(`/api/deudas/${metaId}/registros`, 'Error al cargar registros');

export const putRegistroDia = (metaId: number, fecha: string, monto: number): Promise<RegistroAhorroDia> =>
  send('PUT', `/api/deudas/${metaId}/dias`, { fecha: fecha.slice(0, 10), monto }, 'Error al guardar día');

// ---------------------------------------------------------------------------
// Empleados, nóminas y adelantos
// ---------------------------------------------------------------------------

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

export const getEmpleados = () => get('/api/empleados', 'Error al cargar empleados');

export const postEmpleado = (body: { nombre: string; sueldo: number; puesto?: string }) => send('POST', '/api/empleados', body, 'Error al crear empleado');

export const putEmpleado = (id: number, body: { nombre?: string; sueldo?: number; puesto?: string }) => send('PUT', `/api/empleados/${id}`, body, 'Error al actualizar empleado');

export const deleteEmpleado = (id: number) => send<void>('DELETE', `/api/empleados/${id}`, undefined, 'Error al eliminar empleado');

export const getNominas = () => get('/api/nominas', 'Error al cargar nóminas');

export const deleteNomina = (id: number) => send<{ ok: true; aviso?: string }>('DELETE', `/api/nominas/${id}`, undefined, 'Error al eliminar nómina');

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
  estado: 'activo' | 'liquidado' | 'cancelado';
};

export const getAdelantos = (estado?: 'activo' | 'liquidado') => get(estado ? `/api/adelantos?estado=${estado}` : '/api/adelantos', 'Error al cargar adelantos');

export const postAdelanto = (body: { empleadoId: number; montoTotal: number; semanas: number }) => send('POST', '/api/adelantos', body, 'Error al registrar adelanto');

export const deleteAdelanto = (id: number) => send<{ ok: true; eliminado: boolean }>('DELETE', `/api/adelantos/${id}`, undefined, 'Error al cancelar adelanto');

export const postNomina = (body: { items: { empleadoId: number; nombre: string; monto: number; diasTrabajados?: number; semana?: string }[]; total?: number; fecha?: string }) =>
  send('POST', '/api/nominas', body, 'Error al procesar nómina');

// ---------------------------------------------------------------------------
// Usuarios del sistema (configuración)
// ---------------------------------------------------------------------------

export type Usuario = {
  id: number;
  email: string;
  nombre: string;
  telefono?: string;
  permisos: PermisosPOS;
};

export const getUsuarios = () => get('/api/usuarios', 'Error al cargar usuarios');

export const postUsuario = (body: { email: string; password: string; nombre: string; telefono?: string; permisos?: PermisosPOS }) =>
  send('POST', '/api/usuarios', body, 'Error al crear usuario');

export const putUsuario = (id: number, body: { email?: string; password?: string; nombre?: string; telefono?: string; permisos?: PermisosPOS }) =>
  send('PUT', `/api/usuarios/${id}`, body, 'Error al actualizar usuario');

export const deleteUsuario = (id: number) => send<void>('DELETE', `/api/usuarios/${id}`, undefined, 'Error al eliminar usuario');
