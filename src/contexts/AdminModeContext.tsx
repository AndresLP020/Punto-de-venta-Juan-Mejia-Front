'use client';

import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { getUsuarioSesion, setAdminToken, tieneAdminToken, type PermisosPOS, type UsuarioSesion } from '@/lib/api';

type AdminModeContextType = {
  isAdminMode: boolean;
  setAdminMode: (value: boolean) => void;
  /** Llamar después de verifyAdminPassword (que ya guardó el token de administrador). */
  entrarAdminMode: () => void;
  showMensajeIngreso: boolean;
  cerrarMensajeIngreso: () => void;
  usuario: UsuarioSesion | null;
  /** El modo administrador concede todos los permisos. */
  puede: (permiso: keyof PermisosPOS) => boolean;
};

const AdminModeContext = createContext<AdminModeContextType | null>(null);

export function AdminModeProvider({ children }: { children: React.ReactNode }) {
  const [isAdminMode, setState] = useState(false);
  const [showMensajeIngreso, setShowMensajeIngreso] = useState(false);
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);

  useEffect(() => {
    // El modo administrador depende de que exista un token de administrador firmado por el servidor;
    // modificar sessionStorage a mano no da acceso porque la API valida el token.
    setState(tieneAdminToken());
    setUsuario(getUsuarioSesion());
  }, []);

  const setAdminMode = useCallback((value: boolean) => {
    if (!value) {
      setAdminToken(null);
      setShowMensajeIngreso(false);
    }
    setState(value && tieneAdminToken());
  }, []);

  const entrarAdminMode = useCallback(() => {
    setState(tieneAdminToken());
    setShowMensajeIngreso(true);
  }, []);

  const cerrarMensajeIngreso = useCallback(() => setShowMensajeIngreso(false), []);

  const puede = useCallback(
    (permiso: keyof PermisosPOS) => isAdminMode || Boolean(usuario?.permisos?.[permiso]),
    [isAdminMode, usuario]
  );

  return (
    <AdminModeContext.Provider value={{ isAdminMode, setAdminMode, entrarAdminMode, showMensajeIngreso, cerrarMensajeIngreso, usuario, puede }}>
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode() {
  const ctx = useContext(AdminModeContext);
  if (!ctx) throw new Error('useAdminMode must be used within AdminModeProvider');
  return ctx;
}
