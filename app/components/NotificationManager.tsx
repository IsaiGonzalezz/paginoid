'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/app/firebase/firebaseConfig';
import { useAuth } from './AuthProvider';
import { BellRing, Send, StopCircle } from 'lucide-react';

// --- CONFIGURACIÓN ---
const DEMO_MODE = true; 

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

        const todayKey = new Date().toDateString(); 
        const lastNotified = localStorage.getItem(`last_notification_check_${userId}`);

        if (!DEMO_MODE && !isManualTest && lastNotified === todayKey) {
            console.log("✅ Ya se notificó hoy.");
            return; 
        }

        try {
            const q = query(collection(db, 'users', userId, 'goals'), orderBy('deadline', 'asc'));
            const snapshot = await getDocs(q);
            
            const activeGoals = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as any))
                .filter(g => (g.current || 0) < (g.total || 1));

            if (activeGoals.length === 0) {
                if (isManualTest) alert("No tienes metas pendientes para probar.");
                return;
            }

            const targetGoal = activeGoals[0];
            const count = activeGoals.length;
            const now = new Date();
            const deadlineDate = targetGoal.deadline?.toDate ? targetGoal.deadline.toDate() : new Date();
            
            now.setHours(0,0,0,0);
            const deadlineClean = new Date(deadlineDate);
            deadlineClean.setHours(0,0,0,0);
            
            const diffTime = deadlineClean.getTime() - now.getTime();
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let title = "";
            let body = "";
            let timePhrase = "";

            if (daysLeft < 0) timePhrase = `venció hace ${Math.abs(daysLeft)} días`;
            else if (daysLeft === 0) timePhrase = "vence HOY";
            else if (daysLeft === 1) timePhrase = "vence mañana";
            else timePhrase = `vence en ${daysLeft} días`;

            if (count === 1) {
                title = "🎯 Tu Meta Actual";
                body = `Faltan ${daysLeft} días para terminar "${targetGoal.name}".`;
            } else {
                title = "⚠️ Prioridad";
                body = `"${targetGoal.name}" es la más próxima (${timePhrase}).`;
            }

            await sendRobustNotification(title, body);

            if (!DEMO_MODE && !isManualTest) {
                localStorage.setItem(`last_notification_check_${userId}`, todayKey);
            }

        } catch (error) {
            console.error("Error notificaciones:", error);
        }
    };

    useEffect(() => {
        if (!userId || permission !== 'granted') return;

        if (DEMO_MODE) {
            const interval = setInterval(() => runCheck(true), 10000);
            return () => clearInterval(interval);
        } else {
            const timer = setTimeout(() => runCheck(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [userId, permission]);

    // --- ENVÍO BLINDADO PARA ANDROID ---
    const sendRobustNotification = async (title: string, body: string) => {
        const options: any = {
            body: body,
            // IMPORTANTE: Comentado para evitar error 404 en Android si no existe la imagen
            // icon: '/icon-192x192.png', 
            vibrate: [200, 100, 200], // Vibración fuerte
            tag: DEMO_MODE ? undefined : 'goal-alert',
            requireInteraction: true 
        };

        try {
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                const reg = await navigator.serviceWorker.ready;
                await reg.showNotification(title, options);
            } else {
                new Notification(title, options);
            }
        } catch (e) {
            console.error("Fallo notificación:", e);
            // Fallback visual si falla el sistema nativo
            // alert(title + "\n" + body); 
        }
    };

    const handleRequestPermission = async () => {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === 'granted') setShowBell(false);
    };

    // --- DISEÑO AJUSTADO (MÁS ARRIBA) ---
    return (
        // CAMBIO: bottom-32 (aprox 130px arriba) para librar el menú inferior
        <div className="fixed bottom-32 left-4 z-50 flex flex-col gap-3 items-start pointer-events-none">
            
            {showBell && userId && (
                <button
                    onClick={handleRequestPermission}
                    className="pointer-events-auto bg-indigo-600 text-white p-3 rounded-full shadow-2xl animate-bounce flex items-center gap-2 text-sm font-bold hover:bg-indigo-700 ring-4 ring-white/30"
                >
                    <BellRing className="w-5 h-5" /> Activar Alertas
                </button>
            )}

            {userId && (
                <div className="pointer-events-auto flex flex-col gap-2">
                    <button
                        onClick={() => runCheck(true)} 
                        className="bg-gray-900/90 backdrop-blur-sm text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold border border-gray-700 active:scale-95 transition-all"
                    >
                        <Send className="w-4 h-4 text-green-400" /> 
                        Probar Push
                    </button>
                    
                    {DEMO_MODE && (
                        <span className="bg-red-500/90 text-white px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 animate-pulse shadow-lg backdrop-blur-sm">
                            <StopCircle className="w-3 h-3" />
                            Demo (10s)
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationManager;