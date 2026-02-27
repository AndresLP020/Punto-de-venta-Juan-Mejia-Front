'use client';

import { createContext, useContext, useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'pos-admin-mode';

type AdminModeContextType = {
  isAdminMode: boolean;
  setAdminMode: (value: boolean) => void;
  entrarAdminMode: () => void;
  showMensajeIngreso: boolean;
  cerrarMensajeIngreso: () => void;
};

const AdminModeContext = createContext<AdminModeContextType | null>(null);

export function AdminModeProvider({ children }: { children: React.ReactNode }) {
  const [isAdminMode, setState] = useState(false);
  const [showMensajeIngreso, setShowMensajeIngreso] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY) === '1';
      setState(stored);
    } catch {}
  }, []);

  const setAdminMode = useCallback((value: boolean) => {
    setState(value);
    try {
      if (value) sessionStorage.setItem(STORAGE_KEY, '1');
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
    if (!value) setShowMensajeIngreso(false);
  }, []);

  const entrarAdminMode = useCallback(() => {
    setState(true);
    setShowMensajeIngreso(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {}
  }, []);

  const cerrarMensajeIngreso = useCallback(() => setShowMensajeIngreso(false), []);

  const value: AdminModeContextType = {
    isAdminMode,
    setAdminMode: (v) => {
      setState(v);
      try {
        if (v) sessionStorage.setItem(STORAGE_KEY, '1');
        else sessionStorage.removeItem(STORAGE_KEY);
      } catch {}
      if (!v) setShowMensajeIngreso(false);
    },
    entrarAdminMode,
    showMensajeIngreso,
    cerrarMensajeIngreso,
  };

  return (
    <AdminModeContext.Provider value={value}>
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode() {
  const ctx = useContext(AdminModeContext);
  if (!ctx) throw new Error('useAdminMode must be used within AdminModeProvider');
  return ctx;
}
