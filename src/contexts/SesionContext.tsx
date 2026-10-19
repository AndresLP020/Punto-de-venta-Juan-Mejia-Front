'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSesion, sesionGuardada, type PermisosSesion, type Sesion } from '@/lib/api';
import { useAdminMode } from '@/contexts/AdminModeContext';

type SesionContextType = {
  sesion: Sesion | null;
  /** true si la sesión puede hacer la acción (modo administrador o permiso del usuario) */
  puede: (permiso: keyof PermisosSesion) => boolean;
};

const SesionContext = createContext<SesionContextType>({ sesion: null, puede: () => false });

export const useSesion = () => useContext(SesionContext);

/**
 * Protege todo el POS: sin sesión válida manda a /acceso.
 * Mismas reglas que el servidor: el usuario principal vende y lo demás requiere modo administrador;
 * los usuarios de Configuración usan sus permisos.
 */
export function SesionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAdminMode, setAdminMode } = useAdminMode();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    const guardada = sesionGuardada();
    if (!guardada) {
      router.replace('/acceso');
      return;
    }
    setSesion(guardada);
    setLista(true);
    getSesion().then((s) => {
      if (!s) {
        router.replace('/acceso');
        return;
      }
      setSesion(s);
      if (!s.admin) setAdminMode(false); // el token de administrador ya no es válido
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const puede = (permiso: keyof PermisosSesion) => {
    if (isAdminMode) return true;
    if (!sesion) return false;
    if (sesion.rol === 'admin') return permiso === 'hacerVentas';
    return sesion.permisos?.[permiso] === true;
  };

  if (!lista) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400 text-sm">Verificando sesión…</div>
    );
  }

  return <SesionContext.Provider value={{ sesion, puede }}>{children}</SesionContext.Provider>;
}
