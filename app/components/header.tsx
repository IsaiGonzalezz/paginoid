'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation'; // Importa usePathname
import { LogOut, User, BookOpen, Clock, Target } from 'lucide-react'; // Importa los íconos de navegación
import { signOut } from 'firebase/auth';
import { auth } from '@/app/firebase/firebaseConfig';
import { useAuth } from './AuthProvider';
import Link from 'next/link'; // Importa Link

// Definición de los ítems de navegación (similar al navbar)
const navItems = [
    { name: 'Estantería', href: '/', icon: BookOpen },
    { name: 'Cronómetro', href: '/cronometro', icon: Clock },
    { name: 'Metas', href: '/metas', icon: Target },
];

const Header: React.FC = () => {
    const { userName, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname(); // Usa usePathname para saber qué enlace está activo

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            router.push('/login');
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            alert("Error al cerrar sesión. Revisa la consola.");
        }
    };

    return (
        <header className="w-full bg-blue-600 text-white p-4 shadow-md flex justify-between items-center fixed top-0 z-20">
            <div className="flex items-center space-x-6"> {/* Contenedor para Título y Nav */}
                <h1 className="text-xl font-bold">Mi Estantería</h1>
                
                {/* 1. NAVEGACIÓN DE ESCRITORIO (VISIBLE DESDE 'sm' o 'md') */}
                <nav className="hidden md:flex space-x-4">
                    {navItems.map((item) => {
                        // Lógica para resaltar el enlace activo
                        const isActive = item.href === '/' 
                            ? pathname === '/' 
                            : pathname.startsWith(item.href);
                        
                        return (
                            <Link 
                                key={item.name} 
                                href={item.href} 
                                className={`text-sm font-semibold py-1 px-3 rounded-full transition duration-150 
                                    ${isActive 
                                        ? 'bg-white text-blue-600 shadow-inner' // Estilo activo
                                        : 'hover:bg-blue-500/50 text-white' // Estilo inactivo
                                    }`
                                }
                            >
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>
            
            <div className="flex items-center space-x-4">
                {/* Mostrar nombre de usuario */}
                {!loading && userName && (
                    <div className="flex items-center space-x-2 bg-indigo-700/50 px-3 py-1 rounded-full text-sm font-medium">
                        <User className="w-4 h-4" />
                        {/* Oculta el nombre si la pantalla es muy pequeña para no saturar, o usa una abreviación */}
                        <span className="truncate max-w-[80px] sm:max-w-[120px]">{userName}</span> 
                    </div>
                )}

                {/* Botón de Cerrar Sesión */}
                {!loading && userName && (
                    <button 
                        onClick={handleSignOut}
                        className="flex items-center p-2 rounded-full bg-blue-700 hover:bg-red-500 transition duration-150"
                        title="Cerrar Sesión"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                )}
            </div>
        </header>
    );
}

export default Header;