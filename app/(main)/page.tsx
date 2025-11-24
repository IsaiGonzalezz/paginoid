'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/AuthProvider';
import Modal from '@/app/components/Modal';
import AddBookForm from '@/app/components/AddBookForm';
import BookList from '../components/BookList'; // Asegúrate que la ruta sea correcta
import { Plus, BookOpen } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/app/firebase/firebaseConfig';

// Eliminado "Prestados" de los tipos
type TabStatus = 'Leyendo' | 'Por Leer' | 'Leído';
const TABS: TabStatus[] = ['Leyendo', 'Por Leer', 'Leído'];

// Utilidad para formatear HH:MM:SS
const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map(v => v < 10 ? '0' + v : v).join(':');
};

export default function EstanteriaPage() {
    const router = useRouter();
    const { userId, isAuthenticated, loading } = useAuth();
    
    // Estados UI
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentTab, setCurrentTab] = useState<TabStatus>('Leyendo');
    
    // Estados Métricas
    const [todaySeconds, setTodaySeconds] = useState(0);
    const [weekSeconds, setWeekSeconds] = useState(0);

    // 1. Redirección Auth
    useEffect(() => {
        if (!loading && !isAuthenticated) router.push('/login');
    }, [loading, isAuthenticated, router]);

    // 2. CALCULO DE MÉTRICAS (Lectura Hoy y Semanal)
    useEffect(() => {
        if (!userId) return;

        // Definir rangos de tiempo
        const now = new Date();
        
        // Inicio del Día
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Inicio de la Semana (Domingo como inicio, ajusta si quieres Lunes)
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        // Traemos todas las sesiones recientes (optimización: podríamos filtrar por fecha en query, 
        // pero para weekly/daily es más facil traer un batch y filtrar en cliente si no son millones)
        // Para ser más precisos con Firestore, traemos las sesiones creadas >= startOfWeek
        const q = query(
            collection(db, 'users', userId, 'readingSessions'),
            where('createdAt', '>=', startOfWeek) 
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let daySum = 0;
            let weekSum = 0;

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const sessionDate = data.createdAt?.toDate();
                const seconds = data.durationSeconds || 0;

                if (sessionDate) {
                    // Sumar semanal (ya filtrado por query)
                    weekSum += seconds;
                    
                    // Sumar diario
                    if (sessionDate >= startOfDay) {
                        daySum += seconds;
                    }
                }
            });

            setTodaySeconds(daySum);
            setWeekSeconds(weekSum);
        });

        return () => unsubscribe();
    }, [userId]);

    const handleFormSuccess = () => {
        setIsModalOpen(false);
    };

    if (loading) return <div className="h-screen flex items-center justify-center text-indigo-600 font-bold">Cargando biblioteca...</div>;
    if (!isAuthenticated) return null;

    return (
        <main className="p-4 pt-8 pb-24 max-w-4xl mx-auto min-h-screen bg-white">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-100 rounded-xl">
                    <BookOpen className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Mi Estantería</h2>
            </div>

            {/* Tarjetas de Métricas (REALES) */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-green-50 p-5 rounded-2xl shadow-sm border border-green-100 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-green-100 rounded-bl-full -mr-8 -mt-8 opacity-50"></div>
                    <p className="text-3xl font-black text-green-600 tracking-tight">{formatDuration(todaySeconds)}</p>
                    <p className="text-xs font-bold text-green-700 uppercase tracking-widest mt-1">Hoy</p>
                </div>
                <div className="bg-indigo-50 p-5 rounded-2xl shadow-sm border border-indigo-100 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-100 rounded-bl-full -mr-8 -mt-8 opacity-50"></div>
                    <p className="text-3xl font-black text-indigo-600 tracking-tight">{formatDuration(weekSeconds)}</p>
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mt-1">Semana</p>
                </div>
            </div>

            {/* Pestañas de Filtro (Sin Prestados) */}
            <div className="flex p-1 bg-gray-100 rounded-xl mb-6 overflow-x-auto no-scrollbar">
                {TABS.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setCurrentTab(tab)}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap 
                            ${currentTab === tab
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`
                        }
                    >
                        {tab === 'Leyendo' ? '📖 Leyendo' : tab === 'Por Leer' ? '📅 Por Leer' : '✅ Leído'}
                    </button>
                ))}
            </div>

            {/* Listado de Libros */}
            <div className="w-full">
                <BookList currentTab={currentTab} />
            </div>

            {/* Botón Flotante (FAB) */}
            <button
                onClick={() => setIsModalOpen(true)}
                className="fixed bottom-24 right-6 bg-indigo-600 text-white p-4 rounded-2xl shadow-xl shadow-indigo-300 hover:bg-indigo-700 active:scale-90 transition-all z-40 flex items-center justify-center"
                aria-label="Añadir libro"
            >
                <Plus className="w-7 h-7" />
            </button>
            
            {/* Modal */}
            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)}
                title="Nuevo Libro"
            >
                <AddBookForm onSuccess={handleFormSuccess} />
            </Modal>
        </main>
    );
}