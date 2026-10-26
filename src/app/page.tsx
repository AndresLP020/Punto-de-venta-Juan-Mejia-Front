'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';

const CARACTERISTICAS = [
  {
    titulo: 'Ventas al instante',
    texto: 'Cobra, imprime tickets y controla créditos.',
    color: 'from-fuchsia-500 to-pink-500',
    icono: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  },
  {
    titulo: 'Inventario vivo',
    texto: 'Stock, granel y alertas de faltantes.',
    color: 'from-cyan-400 to-blue-500',
    icono: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  },
  {
    titulo: 'Reportes claros',
    texto: 'Ganancias, gastos y nóminas en un vistazo.',
    color: 'from-amber-400 to-orange-500',
    icono: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState('');
  const [intentoError, setIntentoError] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const user = usuario.trim();
    const pass = password;
    if (!user || !pass) {
      setError('Ingrese usuario y contraseña');
      setIntentoError((n) => n + 1);
      return;
    }
    setLoading(true);
    try {
      await login(user, pass);
      router.push('/pos/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Usuario o contraseña incorrectos');
      setIntentoError((n) => n + 1);
      setLoading(false);
    }
  };

  return (
    <div className="login-bg relative min-h-screen overflow-hidden flex items-center justify-center px-4 py-10">
      {/* Manchas de color animadas */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="blob absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/50 blur-3xl" />
        <div className="blob blob-delay-1 absolute top-1/3 -right-32 h-[30rem] w-[30rem] rounded-full bg-cyan-500/40 blur-3xl" />
        <div className="blob blob-delay-2 absolute -bottom-40 left-1/4 h-[26rem] w-[26rem] rounded-full bg-amber-500/35 blur-3xl" />
        <div className="blob blob-delay-3 absolute top-10 left-1/2 h-72 w-72 rounded-full bg-violet-600/40 blur-3xl" />
        <div className="login-grid absolute inset-0" />
      </div>

      <div className="relative z-10 w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
        {/* Presentación (escritorio) */}
        <section className="hidden lg:block text-white">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-100 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400" />
            Sistema de gestión comercial
          </span>
          <h1 className="mt-6 text-6xl font-black leading-[1.05] tracking-tight">
            Punto de Venta
            <span className="texto-arcoiris block">El Pollito Mixteco</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-white/70">
            Todo tu negocio en un solo lugar: vende rápido, controla tu inventario y conoce tus ganancias reales.
          </p>
          <ul className="mt-10 space-y-4">
            {CARACTERISTICAS.map((c) => (
              <li key={c.titulo} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md transition hover:translate-x-1 hover:bg-white/10">
                <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${c.color} shadow-lg`}>
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={c.icono} />
                  </svg>
                </span>
                <span>
                  <span className="block font-semibold">{c.titulo}</span>
                  <span className="block text-sm text-white/60">{c.texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Tarjeta de acceso */}
        <section className="mx-auto w-full max-w-[440px]">
          <div className="mb-8 text-center lg:hidden">
            <h1 className="text-4xl font-black tracking-tight text-white">
              Punto de Venta <span className="texto-arcoiris block">El Pollito Mixteco</span>
            </h1>
          </div>

          <div className="borde-animado rounded-[1.75rem] p-[2px] shadow-[0_30px_80px_-20px_rgba(217,70,239,0.55)]">
            <div className="rounded-[1.65rem] bg-slate-950/80 p-8 sm:p-10 backdrop-blur-xl">
              <div className="mb-8 flex flex-col items-center text-center">
                <div className="relative mb-5">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-cyan-400 blur-lg opacity-70" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-400 text-white shadow-xl">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white">¡Bienvenido de nuevo!</h2>
                <p className="mt-1.5 text-sm text-white/60">Ingresa tus credenciales para continuar</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="usuario" className="mb-2 block text-sm font-medium text-white/80">
                    Usuario
                  </label>
                  <div className="campo-login group relative">
                    <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40 transition group-focus-within:text-fuchsia-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <input
                      id="usuario"
                      type="text"
                      value={usuario}
                      onChange={(e) => setUsuario(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3.5 pl-12 pr-4 text-white placeholder-white/30 outline-none transition focus:border-fuchsia-400/70 focus:bg-white/10 focus:ring-4 focus:ring-fuchsia-500/20"
                      placeholder="Usuario o correo"
                      autoComplete="username"
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-white/80">
                    Contraseña
                  </label>
                  <div className="campo-login group relative">
                    <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40 transition group-focus-within:text-cyan-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <input
                      id="password"
                      type={verPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3.5 pl-12 pr-12 text-white placeholder-white/30 outline-none transition focus:border-cyan-300/70 focus:bg-white/10 focus:ring-4 focus:ring-cyan-400/20"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setVerPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                      aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {verPassword ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div key={intentoError} className="sacudir flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
                    <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="boton-arcoiris group relative w-full overflow-hidden rounded-xl py-4 text-base font-bold text-white shadow-[0_10px_40px_-10px_rgba(217,70,239,0.8)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-10px_rgba(34,211,238,0.8)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span className="brillo absolute inset-0" aria-hidden />
                  <span className="relative flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Entrando…
                      </>
                    ) : (
                      <>
                        Entrar
                        <svg className="h-5 w-5 transition group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </span>
                </button>
              </form>

              <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-center text-xs text-white/50">
                Los usuarios creados en Configuración entran con su correo electrónico.
              </p>
            </div>
          </div>

          <p className="mt-8 text-center text-xs font-medium text-white/40">Sistema de punto de venta · Versión 1.0</p>
        </section>
      </div>
    </div>
  );
}
