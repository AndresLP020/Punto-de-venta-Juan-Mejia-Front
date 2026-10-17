'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { Logo } from '@/components/Logo';

export default function AccesoPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const user = usuario.trim();
    const pass = password.trim();
    if (!user || !pass) {
      setError('Ingrese usuario y contraseña');
      return;
    }
    setLoading(true);
    try {
      await login(user, pass);
      router.push('/pos/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Usuario o contraseña incorrectos');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-amber-50 px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-100/50 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-[420px] relative">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo size={84} />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">
            Nutri<span className="text-red-600">-</span>Ala
          </h1>
          <p className="text-blue-700 mt-1 text-sm font-semibold">el buen sabor del pollo…</p>
          <p className="text-slate-400 text-xs mt-1">Panel de administración y punto de venta</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="border-b border-slate-100 pb-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-800">Iniciar sesión</h2>
            <p className="text-slate-500 text-sm mt-1">Ingrese sus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="usuario" className="block text-sm font-medium text-slate-700 mb-2">
                Usuario
              </label>
              <input
                id="usuario"
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition text-slate-800 placeholder-slate-400"
                placeholder="Ej. administrador"
                autoComplete="username"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition text-slate-800 placeholder-slate-400"
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                required
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 text-white font-semibold shadow-md hover:from-blue-700 hover:to-blue-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
            Credenciales: usuario <strong>admin</strong>, contraseña configurada en el servidor.
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm font-medium text-blue-700 hover:text-blue-900 transition">
            ← Volver a la página principal
          </Link>
        </div>
      </div>
    </div>
  );
}
