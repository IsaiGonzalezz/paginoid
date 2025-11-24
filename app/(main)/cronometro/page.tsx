'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/app/components/AuthProvider';
import { db } from '@/app/firebase/firebaseConfig';
import { 
    collection, 
    query, 
    getDocs, 
    addDoc, 
    serverTimestamp, 
    orderBy, 
    limit, 
    onSnapshot,
    where,
    Timestamp 
} from 'firebase/firestore';
import { Play, Square, RotateCcw, BookOpen, History, Clock, BarChart3 } from 'lucide-react';

// --- UTILIDADES ---
const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map(v => v < 10 ? '0' + v : v).join(':');
};

const formatTimeShort = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${totalSeconds}s`;
};

// --- HELPER PARA GUARDADO OFFLINE (OPTIMISTA) ---
// Si tarda más de 2s, asumimos que se guardó en local y liberamos la UI
const quickSave = (promise: Promise<any>) => {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.log("⏳ Modo Offline: Guardado local asumido.");
            resolve("offline");
        }, 2000); // 2 segundos de espera máxima

        promise.then((res) => {
            clearTimeout(timeout);
            resolve(res);
        }).catch((err) => {
            clearTimeout(timeout);
            console.error("Error real:", err);
            // Aun con error, resolvemos para no trabar la UI (Firestore reintentará si es red)
            resolve("error-handled"); 
        });
    });
};

// --- INTERFACES ---
interface Book {
    id: string;
    title: string;
}

interface ReadingSession {
    id: string;
    bookTitle: string;
    durationSeconds: number;
    createdAt: Timestamp;
}

interface ChartDataPoint {
    label: string;
    value: number; 
    heightPercent: number;
    fullDate?: string;
}

const CronometroPage: React.FC = () => {
    const { userId } = useAuth();
    
    // --- ESTADOS ---
    const [seconds, setSeconds] = useState<number>(0);
    const [isActive, setIsActive] = useState<boolean>(false);
    
    // Datos
    const [books, setBooks] = useState<Book[]>([]);
    const [selectedBookId, setSelectedBookId] = useState<string>('');
    const [loadingBooks, setLoadingBooks] = useState(true);
    
    // Historial y Estadísticas
    const [recentSessions, setRecentSessions] = useState<ReadingSession[]>([]);
    const [allHistorySessions, setAllHistorySessions] = useState<ReadingSession[]>([]);
    const [statsPeriod, setStatsPeriod] = useState<'days' | 'weeks' | 'months'>('days');
    
    const [saving, setSaving] = useState(false);
    const wakeLockRef = useRef<any>(null);

    // 1. CARGAR LIBROS
    useEffect(() => {
        if (!userId) return;
        const fetchBooks = async () => {
            try {
                const q = query(collection(db, 'users', userId, 'userBooks'));
                const querySnapshot = await getDocs(q);
                const booksData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    title: doc.data().title || 'Libro sin título'
                }));
                setBooks(booksData);
                if (booksData.length > 0) setSelectedBookId(booksData[0].id);
            } catch (error) {
                console.error("Error al cargar libros:", error);
            } finally {
                setLoadingBooks(false);
            }
        };
        fetchBooks();
    }, [userId]);

    // 2. CARGAR SESIONES RECIENTES
    useEffect(() => {
        if (!userId) return;
        const q = query(collection(db, 'users', userId, 'readingSessions'), orderBy('createdAt', 'desc'), limit(5));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ReadingSession[];
            setRecentSessions(sessions);
        });
        return () => unsubscribe();
    }, [userId]);

    // 3. CARGAR HISTORIAL (6 MESES)
    useEffect(() => {
        if (!userId) return;
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const q = query(collection(db, 'users', userId, 'readingSessions'), where('createdAt', '>=', sixMonthsAgo), orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ReadingSession[];
            setAllHistorySessions(sessions);
        });
        return () => unsubscribe();
    }, [userId]);

    // 4. LÓGICA GRÁFICAS (Igual que antes)
    const chartData = useMemo(() => {
        if (allHistorySessions.length === 0) return [];
        const now = new Date();
        let dataPoints: ChartDataPoint[] = [];

        const stripTime = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

        if (statsPeriod === 'days') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(); d.setDate(now.getDate() - i);
                const dayStart = stripTime(d);
                const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
                const totalSeconds = allHistorySessions
                    .filter(s => { const date = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(); return date >= dayStart && date < dayEnd; })
                    .reduce((acc, curr) => acc + curr.durationSeconds, 0);
                dataPoints.push({ label: d.toLocaleDateString('es-ES', { weekday: 'narrow' }), fullDate: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }), value: totalSeconds, heightPercent: 0 });
            }
        } else if (statsPeriod === 'weeks') {
            for (let i = 3; i >= 0; i--) {
                const end = new Date(); end.setDate(now.getDate() - (i * 7));
                const start = new Date(end); start.setDate(start.getDate() - 7);
                const totalSeconds = allHistorySessions
                    .filter(s => { const date = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(); return date >= start && date < end; })
                    .reduce((acc, curr) => acc + curr.durationSeconds, 0);
                dataPoints.push({ label: `Sem ${4 - i}`, fullDate: `${start.getDate()}/${start.getMonth()+1} - ${end.getDate()}/${end.getMonth()+1}`, value: totalSeconds, heightPercent: 0 });
            }
        } else if (statsPeriod === 'months') {
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
                const totalSeconds = allHistorySessions
                    .filter(s => { const date = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(); return date >= d && date < nextMonth; })
                    .reduce((acc, curr) => acc + curr.durationSeconds, 0);
                dataPoints.push({ label: d.toLocaleDateString('es-ES', { month: 'narrow' }), fullDate: d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }), value: totalSeconds, heightPercent: 0 });
            }
        }
        const maxValue = Math.max(...dataPoints.map(d => d.value), 1);
        return dataPoints.map(p => ({ ...p, heightPercent: Math.round((p.value / maxValue) * 100) }));
    }, [allHistorySessions, statsPeriod]);

    // 5. CRONÓMETRO & WAKE LOCK
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (isActive) interval = setInterval(() => setSeconds(prev => prev + 1), 1000);
        return () => { if (interval) clearInterval(interval); };
    }, [isActive]);

    const requestWakeLock = async () => {
        try { if ('wakeLock' in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch (err) { console.log('Wake Lock err', err); }
    };
    const releaseWakeLock = async () => {
        if (wakeLockRef.current) { await wakeLockRef.current.release(); wakeLockRef.current = null; }
    };

    // 6. TOGGLE (INICIAR / DETENER) CON SOPORTE OFFLINE
    const toggle = async () => {
        if (isActive) {
            // DETENER
            if (seconds < 10) {
                if (confirm("Sesión < 10s. ¿Descartar?")) { setIsActive(false); setSeconds(0); releaseWakeLock(); return; }
            }
            
            // Pausar UI inmediatamente
            setIsActive(false);
            setSaving(true);
            releaseWakeLock();

            try {
                const currentBook = books.find(b => b.id === selectedBookId);
                const sessionData = {
                    bookId: selectedBookId,
                    bookTitle: currentBook ? currentBook.title : 'Desconocido',
                    durationSeconds: seconds,
                    createdAt: serverTimestamp(),
                    device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
                };

                // --- TRUCO OFFLINE ---
                // Usamos quickSave para no esperar más de 2s si no hay internet
                await quickSave(addDoc(collection(db, 'users', userId!, 'readingSessions'), sessionData));
                
                // Reiniciamos UI con éxito
                setSeconds(0);
            } catch (error) {
                console.error("Error (pero seguimos):", error);
            } finally {
                setSaving(false);
            }
        } else {
            // INICIAR
            if (!selectedBookId) { alert("Selecciona un libro primero."); return; }
            setIsActive(true);
            requestWakeLock();
        }
    };

    const resetSession = () => {
        if (window.confirm('¿Reiniciar sin guardar?')) { setIsActive(false); setSeconds(0); releaseWakeLock(); }
    };

    return (
        <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 pb-24">
            <div className="max-w-md mx-auto space-y-6">
                
                <div className="text-center space-y-1">
                    <h2 className="text-2xl font-extrabold text-blue-900 flex justify-center items-center gap-2">
                        <Clock className="w-7 h-7 text-blue-600" /> Lectura Activa
                    </h2>
                </div>
                
                <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200">
                    {loadingBooks ? (
                        <div className="p-3 text-center text-gray-400 text-sm">Cargando...</div>
                    ) : books.length === 0 ? (
                        <div className="p-3 text-center text-red-500 text-xs">Agrega un libro primero</div>
                    ) : (
                        <div className="flex items-center px-2">
                            <BookOpen className="w-5 h-5 text-blue-500 mr-3" />
                            <select value={selectedBookId} onChange={(e) => setSelectedBookId(e.target.value)} disabled={isActive} className="w-full p-2 bg-transparent text-gray-800 font-bold text-sm focus:outline-none disabled:text-gray-400">
                                {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                            </select>
                        </div>
                    )}
                </div>
                
                <div className="flex justify-center py-4">
                    <div className={`relative w-60 h-60 rounded-full flex flex-col justify-center items-center transition-all duration-500 shadow-xl ${isActive ? 'bg-white ring-4 ring-green-100 shadow-green-200 scale-105' : 'bg-white ring-4 ring-blue-50 shadow-blue-100'}`}>
                        {isActive && (
                            <span className="absolute top-8 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                        )}
                        <div className="text-5xl font-black text-gray-800 tabular-nums tracking-tighter">{formatTime(seconds)}</div>
                        <p className={`text-xs font-bold mt-2 uppercase tracking-widest ${isActive ? 'text-green-600' : 'text-gray-400'}`}>{isActive ? 'Leyendo...' : 'En pausa'}</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <button onClick={toggle} disabled={loadingBooks || books.length === 0 || saving} className={`w-full py-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 text-lg font-bold transition-all transform active:scale-95 ${isActive ? 'bg-red-500 text-white shadow-red-200' : 'bg-blue-600 text-white shadow-blue-200'} disabled:opacity-50`}>
                        {saving ? 'Guardando...' : isActive ? (<><Square className="w-6 h-6 fill-current" /> PAUSAR</>) : (<><Play className="w-6 h-6 fill-current" /> INICIAR</>)}
                    </button>
                    {!isActive && seconds > 0 && (
                        <button onClick={resetSession} className="w-full py-3 bg-white text-gray-500 font-medium rounded-xl border border-gray-200 shadow-sm flex items-center justify-center gap-2 text-sm"><RotateCcw className="w-4 h-4" /> Cancelar</button>
                    )}
                </div>

                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-500" /> Estadísticas</h3>
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            {(['days', 'weeks', 'months'] as const).map((period) => (
                                <button key={period} onClick={() => setStatsPeriod(period)} className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${statsPeriod === period ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                                    {period === 'days' ? 'Día' : period === 'weeks' ? 'Sem' : 'Mes'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-end justify-between h-32 gap-2 mt-2">
                        {chartData.length === 0 ? (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">Sin datos suficientes</div>
                        ) : (
                            chartData.map((data, index) => (
                                <div key={index} className="flex flex-col items-center justify-end h-full flex-1 group relative">
                                    <div className={`w-full max-w-[20px] rounded-t-md transition-all duration-500 ease-out ${data.value > 0 ? 'bg-indigo-500 group-hover:bg-indigo-600' : 'bg-gray-100'}`} style={{ height: `${data.heightPercent}%`, minHeight: '4px' }}></div>
                                    <span className="text-[10px] text-gray-400 font-medium mt-2 uppercase">{data.label}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {recentSessions.length > 0 && (
                    <div className="pt-2">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 pl-1 flex items-center gap-2"><History className="w-3 h-3" /> Recientes</h3>
                        <div className="space-y-2">
                            {recentSessions.map((session) => (
                                <div key={session.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-800 text-xs">{session.bookTitle}</span>
                                        <span className="text-[10px] text-gray-400">{session.createdAt?.toDate ? session.createdAt.toDate().toLocaleDateString() : 'Pendiente...'}</span>
                                    </div>
                                    <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-bold">{formatTimeShort(session.durationSeconds)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CronometroPage;