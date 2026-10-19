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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-arise-bg text-white px-4 py-12">
      <div className="absolute inset-0 bg-grid-neon [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)] pointer-events-none" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-arise-violet/25 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[420px] relative">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="rounded-full ring-1 ring-arise-neon/50 shadow-glow-strong overflow-hidden">
            <Logo size={84} />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold uppercase tracking-wider text-white">
            ARISE <span className="text-gradient-neon">Athletic Shop</span>
          </h1>
          <p className="text-arise-lavender mt-1 text-sm font-semibold">Tu estilo. Tu fuerza. Tu evolución.</p>
          <p className="text-arise-muted text-xs mt-1">Panel de administración y punto de venta</p>
        </div>

        <div className="bg-arise-card rounded-2xl shadow-xl border border-arise-border p-8">
          <div className="border-b border-arise-border pb-6 mb-6">
            <h2 className="text-lg font-semibold text-white">Iniciar sesión</h2>
            <p className="text-arise-muted text-sm mt-1">Ingrese sus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="usuario" className="block text-sm font-medium text-arise-text2 mb-2">
                Usuario
              </label>
              <input
                id="usuario"
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-arise-border bg-arise-bg2 focus:bg-arise-bg2 focus:border-arise-neon focus:ring-2 focus:ring-arise-neon/30 outline-none transition text-white placeholder-arise-muted"
                placeholder="Ej. administrador"
                autoComplete="username"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-arise-text2 mb-2">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-arise-border bg-arise-bg2 focus:bg-arise-bg2 focus:border-arise-neon focus:ring-2 focus:ring-arise-neon/30 outline-none transition text-white placeholder-arise-muted"
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                required
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 px-4 py-3 rounded-xl">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-neon w-full py-3.5"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-arise-muted bg-arise-bg rounded-lg px-3 py-2">
            Credenciales: usuario <strong>admin</strong>, contraseña configurada en el servidor.
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm font-medium text-arise-lavender hover:text-white transition">
            ← Volver a la página principal
          </Link>
        </div>
      </div>
    </div>
  );
}
