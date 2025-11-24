'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/app/firebase/firebaseConfig';
import { useAuth } from './AuthProvider';
import { BellRing, Send } from 'lucide-react';

const NotificationManager = () => {
    const { userId } = useAuth();
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [showBell, setShowBell] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
            if (Notification.permission === 'default') {
                setShowBell(true);
            }
        }
    }, []);

    // --- LÓGICA PRINCIPAL ---
    const runCheck = async (isManualTest = false) => {
        if (!userId || permission !== 'granted') return;

        // Evitar spam diario (salvo prueba manual)
        const todayKey = new Date().toDateString(); 
        const lastNotified = localStorage.getItem(`last_notification_check_${userId}`);

        if (!isManualTest && lastNotified === todayKey) {
            console.log("✅ Ya se notificó hoy.");
            return; 
        }

        try {
            // 1. Obtener metas ordenadas por fecha límite (la más cercana primero)
            const q = query(collection(db, 'users', userId, 'goals'), orderBy('deadline', 'asc'));
            const snapshot = await getDocs(q);
            
            // Filtrar solo las pendientes
            const activeGoals = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as any))
                .filter(g => (g.current || 0) < (g.total || 1));

            if (activeGoals.length === 0) {
                if (isManualTest) alert("¡Felicidades! No tienes metas pendientes.");
                return;
            }

            // 2. Calcular días restantes de la meta más próxima
            const targetGoal = activeGoals[0];
            const now = new Date();
            // Convertir fecha de Firebase a JS
            const deadlineDate = targetGoal.deadline?.toDate ? targetGoal.deadline.toDate() : new Date();
            
            // Resetear horas para comparar solo días
            now.setHours(0,0,0,0);
            const deadlineClean = new Date(deadlineDate);
            deadlineClean.setHours(0,0,0,0);
            
            const diffTime = deadlineClean.getTime() - now.getTime();
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // 3. DEFINIR MENSAJE SEGÚN TU REGLA
            let title = "";
            let body = "";

            // Frase de tiempo auxiliar
            let timePhrase = "";
            if (daysLeft < 0) timePhrase = `venció hace ${Math.abs(daysLeft)} días`;
            else if (daysLeft === 0) timePhrase = "vence HOY";
            else if (daysLeft === 1) timePhrase = "vence mañana";
            else timePhrase = `vence en ${daysLeft} días`;

            // --- AQUÍ ESTÁ LA LÓGICA QUE PEDISTE ---
            if (activeGoals.length === 1) {
                // CASO 1: SOLO UNA META
                title = "🎯 Tu Meta Actual";
                body = `Faltan ${daysLeft} días para terminar "${targetGoal.name}". ¡Tú puedes!`;
                if(daysLeft <= 0) body = `La meta "${targetGoal.name}" ${timePhrase}.`;
            } else {
                // CASO 2: MÁS DE UNA META (PRIORIDAD)
                title = "⚠️ Meta Prioritaria";
                body = `Atención: "${targetGoal.name}" es la más próxima a vencer (${timePhrase}).`;
            }

            // 4. Enviar Notificación
            await sendRobustNotification(title, body);

            // 5. Guardar registro de hoy
            if (!isManualTest) {
                localStorage.setItem(`last_notification_check_${userId}`, todayKey);
            }

        } catch (error) {
            console.error("Error calculando notificaciones:", error);
        }
    };

    // Ejecutar al entrar (con delay de 3s)
    useEffect(() => {
        const timer = setTimeout(() => runCheck(false), 3000);
        return () => clearTimeout(timer);
    }, [userId, permission]);

    // --- FUNCIÓN DE ENVÍO BLINDADA ---
    const sendRobustNotification = async (title: string, body: string) => {
        console.log(`🔔 Enviando: ${title}`);
        
        const options: any = {
            body: body,
            icon: '/icon-192x192.png', // Asegúrate de tener un icono en public/
            vibrate: [200, 100, 200],
            tag: 'reading-goal-alert',
            requireInteraction: true // Se queda en pantalla hasta que la toques
        };

        try {
            // Intento 1: Service Worker (Ideal para PWA/Android)
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                const reg = await navigator.serviceWorker.ready;
                await reg.showNotification(title, options);
            } 
            // Intento 2: API Clásica (PC/Fallback)
            else {
                new Notification(title, options);
            }
        } catch (e) {
            console.error("Fallo al notificar:", e);
            // Fallback visual si todo falla (solo para pruebas)
            // alert(`${title}\n\n${body}`);
        }
    };

    const handleRequestPermission = async () => {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === 'granted') {
            setShowBell(false);
            sendRobustNotification("¡Alertas Activadas!", "Te avisaremos de tus metas pendientes.");
        }
    };

    // Renderizado de botones
    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
            {/* Botón de Permiso (Solo si falta y hay usuario) */}
            {showBell && userId && (
                <button
                    onClick={handleRequestPermission}
                    className="pointer-events-auto bg-indigo-600 text-white p-3 rounded-full shadow-xl animate-bounce flex items-center gap-2 text-sm font-bold"
                >
                    <BellRing className="w-5 h-5" /> Activar Alertas
                </button>
            )}

            {/* Botón de PRUEBA (Visible solo para que pruebes ahorita, luego lo quitas) */}
            {userId && (
                <button
                    onClick={() => runCheck(true)} 
                    className="pointer-events-auto bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-xs font-bold opacity-80 hover:opacity-100"
                >
                    <Send className="w-3 h-3" /> Probar Push
                </button>
            )}
        </div>
    );
};

export default NotificationManager;