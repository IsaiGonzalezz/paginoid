'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/app/firebase/firebaseConfig';
import { useAuth } from './AuthProvider';
import { BellRing } from 'lucide-react';

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

    useEffect(() => {
        if (!userId || permission !== 'granted') return;

        const runDailyCheck = async () => {
            // 1. EVITAR SPAM: Revisar si ya notificamos hoy
            const todayKey = new Date().toDateString(); 
            const lastNotified = localStorage.getItem(`last_notification_check_${userId}`);

            // TRUCO DE DEBUG: Comenta esta línea if para probar muchas veces seguidas
            if (lastNotified === todayKey) {
                console.log("✅ Ya se notificó hoy. Volveremos mañana.");
                return; 
            }

            console.log("🔍 Buscando metas para notificar...");

            try {
                // 2. TRAER METAS
                // Ordenamos por deadline ascendente (la fecha más vieja/próxima primero)
                const q = query(collection(db, 'users', userId, 'goals'), orderBy('deadline', 'asc'));
                const snapshot = await getDocs(q);
                
                // Filtrar solo las INCOMPLETAS
                const activeGoals = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as any))
                    .filter(g => (g.current || 0) < (g.total || 1));

                if (activeGoals.length === 0) {
                    console.log("🤷‍♂️ No hay metas pendientes.");
                    return;
                }

                // 3. APLICAR TU LÓGICA
                const targetGoal = activeGoals[0]; // La más próxima siempre es la primera por el orderBy
                const count = activeGoals.length;

                // Calcular días restantes
                const now = new Date();
                const deadlineDate = targetGoal.deadline?.toDate ? targetGoal.deadline.toDate() : new Date();
                // Resetear horas para comparar fechas puras
                now.setHours(0,0,0,0);
                deadlineDate.setHours(0,0,0,0);
                
                const diffTime = deadlineDate.getTime() - now.getTime();
                const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // 4. CONSTRUIR MENSAJE
                let title = "";
                let body = "";

                // Frases base según tiempo
                let timePhrase = "";
                if (daysLeft < 0) timePhrase = `venció hace ${Math.abs(daysLeft)} días`;
                else if (daysLeft === 0) timePhrase = "vence HOY";
                else if (daysLeft === 1) timePhrase = "vence mañana";
                else timePhrase = `vence en ${daysLeft} días`;

                if (count === 1) {
                    // CASO A: SOLO 1 META
                    title = "🎯 Tu meta actual";
                    body = `"${targetGoal.name}" ${timePhrase}. ¡Dale caña!`;
                } else {
                    // CASO B: MUCHAS METAS (>1) -> La más próxima
                    title = "⚠️ Meta prioritaria";
                    body = `Atención: "${targetGoal.name}" es tu meta más próxima, ${timePhrase}. (Tienes ${count - 1} más pendientes).`;
                }

                // 5. DISPARAR LA NOTIFICACIÓN (A PRUEBA DE FALLOS)
                await sendRobustNotification(title, body);

                // 6. GUARDAR QUE YA SE HIZO
                localStorage.setItem(`last_notification_check_${userId}`, todayKey);

            } catch (error) {
                console.error("❌ Error calculando notificaciones:", error);
            }
        };

        // Ejecutar a los 3 segundos de entrar
        const timer = setTimeout(runDailyCheck, 3000);
        return () => clearTimeout(timer);

    }, [userId, permission]);

    // --- FUNCIÓN DE ENVÍO ROBUSTA ---
    const sendRobustNotification = async (title: string, body: string) => {
        console.log(`🚀 Intentando enviar: ${title} - ${body}`);

        // Opciones comunes
        const options: any = {
            body: body,
            icon: '/icon-192x192.png', // Asegúrate que existe, si no, no pasa nada grave
            vibrate: [200, 100, 200],
            tag: 'daily-goal-reminder', // Para no encimar notificaciones
            requireInteraction: true // Se queda en pantalla hasta que la toquen (opcional)
        };

        try {
            // INTENTO 1: Service Worker (Mejor para Android/PWA)
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                const reg = await navigator.serviceWorker.ready;
                await reg.showNotification(title, options);
                console.log("✅ Notificación enviada vía Service Worker");
            } 
            // INTENTO 2: API Clásica (Escritorio / Fallback)
            else {
                new Notification(title, options);
                console.log("✅ Notificación enviada vía API Clásica");
            }
        } catch (e) {
            console.error("❌ Falló el envío de notificación:", e);
            // Último recurso: Alerta fea pero efectiva si todo falla (solo para debug)
            // alert(`${title}\n\n${body}`); 
        }
    };

    const handleRequestPermission = async () => {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === 'granted') {
            setShowBell(false);
            sendRobustNotification("¡Listo!", "Ahora te avisaremos del estado de tus metas.");
        }
    };

    if (!showBell) return null;

    return (
        <button
            onClick={handleRequestPermission}
            className="fixed top-4 right-4 z-50 bg-indigo-600 text-white p-3 rounded-full shadow-xl animate-bounce flex items-center gap-2 text-sm font-bold pr-4 hover:bg-indigo-700 transition-all"
        >
            <BellRing className="w-5 h-5" />
            Activar Alertas de Metas
        </button>
    );
};

export default NotificationManager;