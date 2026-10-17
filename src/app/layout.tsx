import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/contexts/CartContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Nutri-Ala | El buen sabor del pollo',
  description: 'Nutri-Ala: pollo fresco y productos de la mejor calidad. Conoce nuestros productos y ofertas.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen bg-surface font-sans antialiased">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
