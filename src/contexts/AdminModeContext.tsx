'use client';

import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { hayTokenAdmin, salirModoAdmin } from '@/lib/api';

// El modo administrador existe mientras haya un token de administrador válido
// (lo entrega el servidor al verificar la contraseña y dura lo que la pestaña).

type AdminModeContextType = {
  isAdminMode: boolean;
  setAdminMode: (value: boolean) => void;
  entrarAdminMode: () => void;
  showMensajeIngreso: boolean;
  cerrarMensajeIngreso: () => void;
};

const AdminModeContext = createContext<AdminModeContextType | null>(null);

export function AdminModeProvider({ children }: { children: React.ReactNode }) {
  // Lectura inmediata para que al recargar una página de administrador no se redirija por error
  const [isAdminMode, setState] = useState(() => typeof window !== 'undefined' && hayTokenAdmin());
  const [showMensajeIngreso, setShowMensajeIngreso] = useState(false);

  useEffect(() => {
    setState(hayTokenAdmin());
  }, []);

  const setAdminMode = useCallback((value: boolean) => {
    if (!value) {
      salirModoAdmin();
      setShowMensajeIngreso(false);
    }
    setState(value && hayTokenAdmin());
  }, []);

  // Se llama después de verifyAdminPassword, que ya guardó el token
  const entrarAdminMode = useCallback(() => {
    setState(hayTokenAdmin());
    setShowMensajeIngreso(true);
  }, []);

  const cerrarMensajeIngreso = useCallback(() => setShowMensajeIngreso(false), []);

  return (
    <AdminModeContext.Provider value={{ isAdminMode, setAdminMode, entrarAdminMode, showMensajeIngreso, cerrarMensajeIngreso }}>
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode() {
  const ctx = useContext(AdminModeContext);
  if (!ctx) throw new Error('useAdminMode must be used within AdminModeProvider');
  return ctx;
}
