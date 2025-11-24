import React from 'react';
import Navbar from '../components/navbar';
import Header from '../components/header';



export default function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Encabezado fijo superior */}
            <Header />
            
            {/* Contenido principal: Deja espacio para el header superior y el navbar inferior */}
            <main className="pt-16 pb-20 p-4 max-w-4xl mx-auto">
                {children}
            </main>
            
            {/* Barra de navegación inferior PWA */}
            <Navbar />
        </div>
    );
}
