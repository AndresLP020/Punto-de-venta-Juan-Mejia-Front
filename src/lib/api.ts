const BASE = process.env.NEXT_PUBLIC_API_URL || '';

export async function getProductos(proveedorId?: number) {
  const url = proveedorId != null ? `${BASE}/api/productos?proveedorId=${proveedorId}` : `${BASE}/api/productos`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error al cargar productos');
  return res.json();
}

export async function getCategorias() {
  const res = await fetch(`${BASE}/api/categorias`);
  if (!res.ok) throw new Error('Error al cargar categorías');
  return res.json();
}

export async function postCategoria(nombre: string) {
  const res = await fetch(`${BASE}/api/categorias`, {
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
  const res = await fetch(`${BASE}/api/categorias/${encodeURIComponent(nombre)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al eliminar categoría');
  }
  return res.json();
}

export async function getProductoPorCodigo(codigo: string) {
  const res = await fetch(`${BASE}/api/productos/codigo/${codigo}`);
  if (!res.ok) throw new Error('Producto no encontrado');
  return res.json();
}

export async function getVentas() {
  const res = await fetch(`${BASE}/api/ventas`);
  if (!res.ok) throw new Error('Error al cargar ventas');
  return res.json();
}

export async function postVenta(body: { items: { id: number; nombre: string; precio: number; cantidad: number; costo?: number }[]; total: number; cliente?: string; clienteId?: number; pagado?: number }) {
  const res = await fetch(`${BASE}/api/ventas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Error al registrar venta');
  return res.json();
}

export type DevolucionItem = { productoId: number; nombre: string; cantidad: number; precio: number; tipo: 'revendible' | 'perdida' };
export type Devolucion = { id: number; fecha: string; ventaId: number; items: DevolucionItem[] };
export type PerdidaItem = { id: number; fecha: string; ventaId: number; productoId: number; nombre: string; cantidad: number; precio: number; valorPerdida: number };

export async function getDevoluciones(): Promise<Devolucion[]> {
  const res = await fetch(`${BASE}/api/devoluciones`);
  if (!res.ok) throw new Error('Error al cargar devoluciones');
  return res.json();
}

export async function getPerdidas(): Promise<PerdidaItem[]> {
  const res = await fetch(`${BASE}/api/devoluciones/perdidas`);
  if (!res.ok) throw new Error('Error al cargar pérdidas');
  return res.json();
}

export async function postDevolucion(body: { ventaId?: number | null; items: { id: number; nombre: string; cantidad: number; precio: number; tipo: 'revendible' | 'perdida' }[] }) {
  const res = await fetch(`${BASE}/api/devoluciones`, {
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
  const res = await fetch(`${BASE}/api/ventas/${ventaId}/abonar`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ monto }),
  });
  if (!res.ok) throw new Error('Error al registrar abono');
  return res.json();
}

export async function getClientes() {
  const res = await fetch(`${BASE}/api/clientes`);
  if (!res.ok) throw new Error('Error al cargar clientes');
  return res.json();
}

export async function postCliente(body: { nombre: string; telefono?: string; email?: string; direccion?: string }) {
  const res = await fetch(`${BASE}/api/clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Error al crear cliente');
  return res.json();
}

export async function putCliente(id: number, body: { nombre?: string; telefono?: string; email?: string; direccion?: string }) {
  const res = await fetch(`${BASE}/api/clientes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Error al actualizar cliente');
  return res.json();
}

export async function deleteCliente(id: number) {
  const res = await fetch(`${BASE}/api/clientes/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar cliente');
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
  const res = await fetch(`${BASE}/api/proveedores`);
  if (!res.ok) throw new Error('Error al cargar proveedores');
  return res.json();
}

export async function postProveedor(body: { nombre: string; telefono?: string; email?: string; direccion?: string }) {
  const res = await fetch(`${BASE}/api/proveedores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Error al crear proveedor');
  return res.json();
}

export async function putProveedor(id: number, body: { nombre?: string; telefono?: string; email?: string; direccion?: string }) {
  const res = await fetch(`${BASE}/api/proveedores/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Error al actualizar proveedor');
  return res.json();
}

export async function deleteProveedor(id: number) {
  const res = await fetch(`${BASE}/api/proveedores/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar proveedor');
}

export async function postProducto(body: { nombre: string; codigo?: string; categoria: string; precio: number; costo?: number; stock?: number; stockMinimo?: number; estado?: string; esGranel?: boolean; proveedorId?: number }) {
  const res = await fetch(`${BASE}/api/productos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Error al crear producto');
  return res.json();
}

export async function putProducto(id: number, body: { nombre?: string; codigo?: string; categoria?: string; precio?: number; costo?: number; stock?: number; stockMinimo?: number; estado?: string; esGranel?: boolean; proveedorId?: number | null }) {
  const res = await fetch(`${BASE}/api/productos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Error al actualizar producto');
  return res.json();
}

export async function deleteProducto(id: number) {
  const res = await fetch(`${BASE}/api/productos/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar producto');
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
};

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
  'Gastos de la empresa',
] as const;

export async function getGastosAdmin() {
  const res = await fetch(`${BASE}/api/gastos-admin`);
  if (!res.ok) throw new Error('Error al cargar gastos');
  return res.json();
}

export async function postGastoAdmin(body: { fecha?: string; descripcion: string; categoria: string; monto: number }) {
  const res = await fetch(`${BASE}/api/gastos-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Error al registrar gasto');
  return res.json();
}

export async function putGastoAdmin(id: number, body: { fecha?: string; descripcion?: string; categoria?: string; monto?: number }) {
  const res = await fetch(`${BASE}/api/gastos-admin/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Error al actualizar gasto');
  return res.json();
}

export async function deleteGastoAdmin(id: number) {
  const res = await fetch(`${BASE}/api/gastos-admin/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar gasto');
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
  const res = await fetch(`${BASE}/api/deudas`);
  if (!res.ok) throw new Error('Error al cargar metas de ahorro');
  return res.json();
}

export async function postMetaAhorro(body: { nombre: string; meta: number; fechaLimite: string }) {
  const res = await fetch(`${BASE}/api/deudas`, {
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
  const res = await fetch(`${BASE}/api/deudas/${id}`, {
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
  const res = await fetch(`${BASE}/api/deudas/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al eliminar meta de ahorro');
  }
}

export type RegistroAhorroDia = { fecha: string; monto: number };

export async function getRegistrosAhorro(metaId: number): Promise<RegistroAhorroDia[]> {
  const res = await fetch(`${BASE}/api/deudas/${metaId}/registros`);
  if (!res.ok) throw new Error('Error al cargar registros');
  return res.json();
}

export async function putRegistroDia(metaId: number, fecha: string, monto: number): Promise<RegistroAhorroDia> {
  const res = await fetch(`${BASE}/api/deudas/${metaId}/dias`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fecha: fecha.slice(0, 10), monto }),
  });
  if (!res.ok) throw new Error('Error al guardar día');
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
  const res = await fetch(`${BASE}/api/empleados`);
  if (!res.ok) throw new Error('Error al cargar empleados');
  return res.json();
}

export async function postEmpleado(body: { nombre: string; sueldo: number; puesto?: string }) {
  const res = await fetch(`${BASE}/api/empleados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Error al crear empleado');
  return res.json();
}

export async function putEmpleado(id: number, body: { nombre?: string; sueldo?: number; puesto?: string }) {
  const res = await fetch(`${BASE}/api/empleados/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Error al actualizar empleado');
  return res.json();
}

export async function deleteEmpleado(id: number) {
  const res = await fetch(`${BASE}/api/empleados/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar empleado');
}

export async function getNominas() {
  const res = await fetch(`${BASE}/api/nominas`);
  if (!res.ok) throw new Error('Error al cargar nóminas');
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
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error al cargar adelantos');
  return res.json();
}

export async function postAdelanto(body: { empleadoId: number; montoTotal: number; semanas: number }) {
  const res = await fetch(`${BASE}/api/adelantos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Error al registrar adelanto');
  return res.json();
}

export async function postNomina(body: {
  items: { empleadoId: number; nombre: string; monto: number; diasTrabajados?: number; semana?: string }[];
  total?: number;
  fecha?: string;
}) {
  const res = await fetch(`${BASE}/api/nominas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Error al procesar nómina');
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
  const res = await fetch(`${BASE}/api/usuarios`);
  if (!res.ok) throw new Error('Error al cargar usuarios');
  return res.json();
}

export async function postUsuario(body: {
  email: string;
  password: string;
  nombre: string;
  telefono?: string;
  permisos?: PermisosPOS;
}) {
  const res = await fetch(`${BASE}/api/usuarios`, {
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
  const res = await fetch(`${BASE}/api/usuarios/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Error al actualizar usuario');
  return res.json();
}

export async function deleteUsuario(id: number) {
  const res = await fetch(`${BASE}/api/usuarios/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar usuario');
}

export async function verifyAdminPassword(password: string): Promise<{ ok: true }> {
  const res = await fetch(`${BASE}/api/auth/verify-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Contraseña incorrecta');
  }
  return res.json();
}
