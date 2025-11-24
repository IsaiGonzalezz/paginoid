// app/layout.tsx
import './globals.css';
import { AuthProvider } from './components/AuthProvider';

export const metadata = {
  title: 'Paginoid',
  description: 'Gestión de lectura personal',
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        {/* VINCULACIÓN DEL MANIFEST */}
        <link rel="manifest" href="/manifest.json" /> 
        <meta name="theme-color" content="#2563eb" />
        {/* Configuración de Apple PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Estantería" />
      </head>

      <body className="bg-gray-50 text-gray-900">
        {/* 🔐 El AuthProvider envuelve toda la app */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
