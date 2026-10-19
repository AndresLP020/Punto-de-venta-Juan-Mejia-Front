import type { Metadata } from 'next';
import { Inter, Rajdhani } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/contexts/CartContext';
import { LOGO_SRC } from '@/lib/tienda';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const rajdhani = Rajdhani({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display' });

const TITULO = 'ARISE Athletic Shop | Ropa Deportiva y Fitness';
const DESCRIPCION =
  'Descubre ARISE Athletic Shop, tu tienda de ropa deportiva y fitness. Encuentra prendas diseñadas para acompañarte en cada entrenamiento con estilo, comodidad y actitud.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://punto-de-venta-juan-mejia-front.vercel.app'),
  title: TITULO,
  description: DESCRIPCION,
  applicationName: 'ARISE Athletic Shop',
  keywords: [
    'ARISE Athletic Shop',
    'ropa deportiva',
    'fitness',
    'gym wear',
    'ropa para gimnasio',
    'ropa de entrenamiento',
    'moda fitness',
    'ropa deportiva para hombre',
    'ropa deportiva para mujer',
  ],
  icons: {
    icon: LOGO_SRC,
    shortcut: LOGO_SRC,
    apple: LOGO_SRC,
  },
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    siteName: 'ARISE Athletic Shop',
    type: 'website',
    locale: 'es_MX',
    images: [{ url: LOGO_SRC, alt: 'ARISE Athletic Shop' }],
  },
  twitter: {
    card: 'summary',
    title: TITULO,
    description: DESCRIPCION,
    images: [LOGO_SRC],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#07050B',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${rajdhani.variable}`}>
      <body className="min-h-screen bg-arise-bg font-sans antialiased">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
