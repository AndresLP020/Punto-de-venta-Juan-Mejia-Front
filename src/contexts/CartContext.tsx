'use client';

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import type { Producto } from '@/lib/api';

const STORAGE_KEY = 'nutri-ala-carrito';

export type CartItem = {
  id: number;
  nombre: string;
  precio: number;
  cantidad: number;
  esGranel?: boolean;
  imagen?: string;
  stock?: number;
};

type CartContextType = {
  items: CartItem[];
  agregar: (producto: Producto, cantidad?: number) => void;
  quitar: (id: number) => void;
  actualizarCantidad: (id: number, cantidad: number) => void;
  limpiar: () => void;
  reemplazar: (items: CartItem[]) => void;
  totalUnidades: number;
  lineas: number;
  subtotal: number;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setCargado(true);
  }, []);

  useEffect(() => {
    if (!cargado) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, cargado]);

  const agregar = useCallback((producto: Producto, cantidad = 1) => {
    setItems((prev) => {
      const existente = prev.find((i) => i.id === producto.id);
      if (existente) {
        return prev.map((i) =>
          i.id === producto.id ? { ...i, cantidad: Math.round((i.cantidad + cantidad) * 1000) / 1000 } : i
        );
      }
      return [
        ...prev,
        {
          id: producto.id,
          nombre: producto.nombre,
          precio: producto.precio,
          cantidad,
          esGranel: producto.esGranel,
          imagen: producto.imagen,
          stock: producto.stock,
        },
      ];
    });
  }, []);

  const quitar = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const actualizarCantidad = useCallback((id: number, cantidad: number) => {
    setItems((prev) => {
      if (cantidad <= 0) return prev.filter((i) => i.id !== id);
      return prev.map((i) => (i.id === id ? { ...i, cantidad } : i));
    });
  }, []);

  const limpiar = useCallback(() => setItems([]), []);

  const reemplazar = useCallback((nuevos: CartItem[]) => {
    setItems(nuevos);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevos));
    } catch {}
  }, []);

  const totalUnidades = useMemo(() => items.reduce((s, i) => s + i.cantidad, 0), [items]);
  const lineas = items.length;
  const subtotal = useMemo(
    () => Math.round(items.reduce((s, i) => s + i.precio * i.cantidad, 0) * 100) / 100,
    [items]
  );

  const value: CartContextType = {
    items,
    agregar,
    quitar,
    actualizarCantidad,
    limpiar,
    reemplazar,
    totalUnidades,
    lineas,
    subtotal,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider');
  return ctx;
}
