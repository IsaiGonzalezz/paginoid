'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/app/firebase/firebaseConfig';
import { useAuth } from './AuthProvider';
import { BellRing, Send, StopCircle, Bug, RefreshCw } from 'lucide-react';

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

            // Enviar notificación (con isDebug pasado desde el botón)
            await sendRobustNotification(title, body, isManualTest);

            if (!DEMO_MODE && !isManualTest) {
                localStorage.setItem(`last_notification_check_${userId}`, todayKey);
            }

        } catch (error: any) {
            if (isManualTest) alert(`Error lógico: ${error.message}`);
        }
    };

    useEffect(() => {
        if (!userId || permission !== 'granted') return;

        if (DEMO_MODE) {
            const interval = setInterval(() => runCheck(false), 10000);
            return () => clearInterval(interval);
        } else {
            const timer = setTimeout(() => runCheck(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [userId, permission]);

    // --- ENVÍO CON AUTOCURACIÓN ---
    const sendRobustNotification = async (title: string, body: string, isDebug: boolean) => {
        const options: any = {
            body: body,
            requireInteraction: true,
            tag: 'goal-alert'
        };

        try {
            // 1. Verificar soporte
            if (!('serviceWorker' in navigator)) {
                if (isDebug) alert("❌ Tu navegador no soporta Service Workers (PWA).");
                return;
            }

            // 2. Obtener Registro
            let reg = await navigator.serviceWorker.getRegistration();

            // --- AUTOCURACIÓN: Si no existe, lo registramos a la fuerza ---
            if (!reg) {
                if (isDebug) alert("⚠️ SW perdido. Intentando registrar '/sw.js' manualmente...");
                
                try {
                    reg = await navigator.serviceWorker.register('/sw.js');
                    if (isDebug) alert("✅ SW registrado con éxito. Esperando activación...");
                    
                    // Esperamos un poco a que se active
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (err: any) {
                    if (isDebug) alert(`❌ Falló registro manual: ${err.message}. Verifica que el archivo sw.js exista en public.`);
                    // Último intento desesperado con API clásica si falla el registro
                    new Notification(title, options);
                    return;
                }
            }

            // 3. Ejecutar notificación
            if (reg) {
                await reg.showNotification(title, options);
                if (isDebug) console.log("🚀 Notificación enviada.");
            }

        } catch (e: any) {
            if (isDebug) alert(`❌ Error final: ${e.message}`);
        }
    };

    const handleRequestPermission = async () => {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === 'granted') {
            setShowBell(false);
            // Intentamos registrar el SW apenas nos den permiso por si acaso
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(console.error);
            }
            alert("Permiso concedido. Prueba el botón gris.");
        }
    };

    // Botón de Reset SW (Por si todo falla)
    const resetSW = async () => {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
            alert("🧹 Service Workers limpiados. Recarga la página para reinstalar.");
            window.location.reload();
        }
    };

    return (
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
                    <div className="flex gap-2">
                        <button
                            onClick={() => runCheck(true)} 
                            className="bg-gray-900/90 backdrop-blur-sm text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold border border-gray-700 active:scale-95 transition-all"
                        >
                            <Bug className="w-4 h-4 text-yellow-400" /> 
                            Diagnóstico Push
                        </button>
                        
                        {/* Botón de Pánico: Limpiar SW */}
                        <button
                            onClick={resetSW}
                            className="bg-red-600/90 text-white p-3 rounded-xl shadow-xl flex items-center justify-center active:scale-95"
                            title="Resetear Service Worker"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                    
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