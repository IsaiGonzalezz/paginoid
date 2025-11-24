'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/app/firebase/firebaseConfig';
import { useAuth } from './AuthProvider';
import { Bell, BellRing } from 'lucide-react';

const NotificationManager = () => {
    const { userId } = useAuth();
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [showBell, setShowBell] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
            // Si no ha dado permiso, mostramos la campanita
            if (Notification.permission === 'default') {
                setShowBell(true);
            }
        }
    }, []);

    // Lógica Principal: Se ejecuta cuando hay usuario y permiso
    useEffect(() => {
        if (!userId || permission !== 'granted') return;

        const checkAndNotify = async () => {
            // 1. Verificar si ya notificamos HOY
            const todayStr = new Date().toDateString(); 
            const lastNotified = localStorage.getItem(`last_notification_${userId}`);

            if (lastNotified === todayStr) {
                console.log("✅ El usuario ya recibió su resumen diario hoy.");
                return; 
            }

            try {
                // 2. Buscar la meta más próxima a vencer
                const q = query(
                    collection(db, 'users', userId, 'goals'),
                    orderBy('deadline', 'asc') // Las que vencen primero arriba
                );

                const snapshot = await getDocs(q);
                
                // Filtramos en memoria las que no están completadas
                const pendingGoals = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as any))
                    .filter(g => (g.current || 0) < (g.total || 1));

                if (pendingGoals.length === 0) return;

                const topGoal = pendingGoals[0]; // La más urgente
                
                // Calcular días restantes
                const now = new Date();
                const deadlineDate = topGoal.deadline?.toDate ? topGoal.deadline.toDate() : new Date();
                const diffTime = deadlineDate.getTime() - now.getTime();
                const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // 3. Construir el mensaje perfecto
                let title = "📅 Tu Resumen de Lectura";
                let body = "";

                if (daysLeft < 0) {
                    title = "⚠️ Meta Vencida";
                    body = `La meta "${topGoal.name}" venció hace ${Math.abs(daysLeft)} días. ¡Nunca es tarde para retomarla!`;
                } else if (daysLeft === 0) {
                    title = "🚨 ¡ES HOY!";
                    body = `Hoy es el último día para cumplir "${topGoal.name}". ¡Tú puedes!`;
                } else if (daysLeft <= 3) {
                    title = "⏳ Se acaba el tiempo";
                    body = `Solo quedan ${daysLeft} días para terminar "${topGoal.name}". ¡A leer!`;
                } else {
                    title = "📚 Mantén el ritmo";
                    body = `Te quedan ${daysLeft} días para completar "${topGoal.name}". Vas bien.`;
                }

                // 4. Enviar la notificación
                sendLocalNotification(title, body);

                // 5. Marcar como hecho hoy
                localStorage.setItem(`last_notification_${userId}`, todayStr);

            } catch (error) {
                console.error("Error en notificaciones:", error);
            }
        };

        // Esperamos 3 segundos para no abrumar al abrir la app
        const timer = setTimeout(checkAndNotify, 3000);
        return () => clearTimeout(timer);

    }, [userId, permission]);

    // Función para disparar la notificación nativa
    const sendLocalNotification = (title: string, body: string) => {
        // Intenta usar Service Worker (Mejor para Android)
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then((registration) => {
                registration.showNotification(title, {
                    body: body,
                    icon: '/icon-192x192.png', // Asegúrate de tener este ícono en public
                    vibrate: [200, 100, 200],
                    badge: '/icon-192x192.png',
                    tag: 'daily-update'
                } as any); // <--- CAMBIO AQUÍ: 'as any' elimina el error de TypeScript
            });
        } else {
            // Fallback navegador escritorio
            new Notification(title, { body, icon: '/icon-192x192.png' });
        }
    };

    // Manejador para pedir permiso (Click de usuario requerido por navegadores)
    const handleRequestPermission = async () => {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === 'granted') {
            setShowBell(false);
            sendLocalNotification("¡Activado!", "Te avisaremos del estado de tus metas.");
        }
    };

    // Si ya tiene permiso o denegado, no mostramos nada visual (es invisible)
    if (!showBell) return null;

    // Si falta permiso, mostramos un botón flotante discreto
    return (
        <button
            onClick={handleRequestPermission}
            className="fixed top-4 right-4 z-50 bg-indigo-600 text-white p-3 rounded-full shadow-xl animate-bounce flex items-center gap-2 text-sm font-bold pr-4 hover:bg-indigo-700 transition-all"
        >
            <BellRing className="w-5 h-5" />
            Activar Alertas
        </button>
    );
};

export default NotificationManager;