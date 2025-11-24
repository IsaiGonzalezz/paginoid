'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
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
        if (!userId || permission !== 'granted') {
            if(isManualTest) alert("Faltan permisos o usuario.");
            return;
        }

        const todayKey = new Date().toDateString(); 
        const lastNotified = localStorage.getItem(`last_notification_check_${userId}`);

        if (!DEMO_MODE && !isManualTest && lastNotified === todayKey) {
            console.log("✅ Ya se notificó hoy.");
            return; 
        }

        try {
            const q = query(collection(db, 'users', userId, 'goals'));
            const snapshot = await getDocs(q);
            
            let activeGoals = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as any))
                .filter(g => {
                    const current = Number(g.current) || 0;
                    const total = Number(g.total) || 1;
                    return current < total;
                });

            if (activeGoals.length === 0) {
                if (isManualTest) alert(`0 metas pendientes encontradas.`);
                return;
            }

            activeGoals.sort((a, b) => {
                const dateA = a.deadline?.toDate ? a.deadline.toDate() : new Date(2100,0,1);
                const dateB = b.deadline?.toDate ? b.deadline.toDate() : new Date(2100,0,1);
                return dateA.getTime() - dateB.getTime();
            });

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

            // Enviar notificación real
            await sendRobustNotification(title, body);

            if (!DEMO_MODE && !isManualTest) {
                localStorage.setItem(`last_notification_check_${userId}`, todayKey);
            }

        } catch (error: any) {
            console.error("Error:", error);
            if (isManualTest) alert(`Error en lógica: ${error.message}`);
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

    // --- ENVÍO BLINDADO (VERSIÓN CORREGIDA PARA ANDROID) ---
    const sendRobustNotification = async (title: string, body: string) => {
        // Opciones estándar que Android soporta bien
        const options: any = {
            body: body,
            icon: 'icons/icon-192x192.png', // IMPORTANTE: Si este archivo no existe en 'public', Android puede ignorar la notificación
            badge: '/icon-192x192.png',
            vibrate: [200, 100, 200],
            tag: 'goal-alert',
            data: { url: window.location.href } // Para abrir la app al tocar
        };

        try {
            // PASO 1: Intentar obtener el Service Worker ACTIVO
            const reg = await navigator.serviceWorker.getRegistration();

            if (reg) {
                // Método preferido y más estable en Android
                await reg.showNotification(title, options);
                console.log("✅ Enviado vía SW Registration");
            } else {
                // Fallback solo si no hay SW (Raro en PWA instalada)
                console.log("⚠️ No se encontró SW, usando API clásica");
                new Notification(title, options);
            }

        } catch (e: any) {
            console.error("Fallo notificación:", e);
            // Ahora el alert te dirá QUÉ falló exactamente
            alert(`ERROR DE SISTEMA:\n${e.message}\n\nIntenta reinstalar la app.`); 
        }
    };

    const handleRequestPermission = async () => {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === 'granted') setShowBell(false);
    };

    return (
        // BOTONES ELEVADOS PARA NO ESTORBAR
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