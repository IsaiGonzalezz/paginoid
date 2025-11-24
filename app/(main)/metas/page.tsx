'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/components/AuthProvider';
import { db } from '@/app/firebase/firebaseConfig';
import { 
    collection, 
    addDoc, 
    query, 
    onSnapshot, 
    orderBy, 
    doc, 
    updateDoc, 
    deleteDoc, 
    serverTimestamp,
    Timestamp 
} from 'firebase/firestore';
import { Target, PlusCircle, X, Trash2, Plus, Minus, Trophy, TrendingUp, RefreshCw, Calendar, Clock, AlertTriangle } from 'lucide-react';



// --- HELPER PARA GUARDADO OFFLINE ---
const quickSave = (promise: Promise<any>) => {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.log("⏳ Modo Offline: Cierre forzado del modal.");
            resolve("offline");
        }, 2000); // 2 segundos máximo

        promise.then((res) => {
            clearTimeout(timeout);
            resolve(res);
        }).catch((err) => {
            clearTimeout(timeout);
            console.error(err);
            resolve("error-handled");
        });
    });
};

// Interfaz Goal
interface Goal {
    id: string;
    name: string;
    unit: string;
    current: number;
    total: number;
    deadline: Timestamp;
    createdAt?: Timestamp; 
}

const MetasPage: React.FC = () => {
    const { userId } = useAuth();
    
    // Estados principales
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Estados de DATOS CRUDOS
    const [allBooks, setAllBooks] = useState<any[]>([]);
    const [allSessions, setAllSessions] = useState<any[]>([]);

    // Estados UI
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Formulario
    const [newGoalData, setNewGoalData] = useState({
        name: '',
        unit: 'Libros', 
        totalQty: 1,    
        hours: 0,       
        minutes: 0,     
        deadlineDate: '' 
    });

    // --- 1. CARGAR DATOS ---
    useEffect(() => {
        if (!userId) return;

        const qGoals = query(collection(db, 'users', userId, 'goals'), orderBy('createdAt', 'desc'));
        const unsubGoals = onSnapshot(qGoals, (snapshot) => {
            setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal)));
            setLoading(false);
        });

        const qBooks = query(collection(db, 'users', userId, 'userBooks'));
        const unsubBooks = onSnapshot(qBooks, (snapshot) => setAllBooks(snapshot.docs.map(doc => doc.data())));

        const qSessions = query(collection(db, 'users', userId, 'readingSessions'));
        const unsubSessions = onSnapshot(qSessions, (snapshot) => setAllSessions(snapshot.docs.map(doc => doc.data())));

        return () => { unsubGoals(); unsubBooks(); unsubSessions(); };
    }, [userId]);


    // --- 2. LÓGICA DE CÁLCULO ---
    const calculateProgress = (goal: Goal) => {
        if (goal.unit === 'Capítulos') return goal.current;

        const startDate = goal.createdAt?.toDate ? goal.createdAt.toDate() : new Date(0);
        const endDate = goal.deadline?.toDate ? goal.deadline.toDate() : new Date(2100, 0, 1);

        let calculatedValue = 0;

        if (goal.unit === 'Libros') {
            calculatedValue = allBooks.filter(book => {
                if (book.status !== 'Leído') return false;
                const finishedDate = book.finishedAt?.toDate ? book.finishedAt.toDate() : null;
                if (finishedDate && finishedDate >= startDate && finishedDate <= endDate) return true;
                return false;
            }).length;
        } 
        else if (goal.unit === 'Páginas') {
            const pagesReading = allBooks.filter(b => b.status === 'Leyendo').reduce((sum, b) => sum + (b.currentPage || 0), 0);
            const pagesRead = allBooks.filter(b => {
                if (b.status !== 'Leído') return false;
                const finishedDate = b.finishedAt?.toDate ? b.finishedAt.toDate() : null;
                return finishedDate && finishedDate >= startDate && finishedDate <= endDate;
            }).reduce((sum, b) => sum + (b.totalPages || 0), 0);
            calculatedValue = pagesReading + pagesRead;
        } 
        else if (goal.unit === 'Horas') {
            const totalSeconds = allSessions.filter(session => {
                const sessionDate = session.createdAt?.toDate ? session.createdAt.toDate() : null;
                return sessionDate && sessionDate >= startDate && sessionDate <= endDate;
            }).reduce((sum, session) => sum + (session.durationSeconds || 0), 0);
            calculatedValue = parseFloat((totalSeconds / 3600).toFixed(2));
        }

        return calculatedValue;
    };

    // --- 3. CREAR META (Con soporte Offline) ---
    const handleCreateGoal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId || !newGoalData.name || !newGoalData.deadlineDate) return;

        setSubmitting(true);
        try {
            let finalTotal = 0;
            if (newGoalData.unit === 'Horas') {
                finalTotal = Number(newGoalData.hours) + (Number(newGoalData.minutes) / 60);
            } else {
                finalTotal = Number(newGoalData.totalQty);
            }

            if (finalTotal <= 0) { alert("La cantidad debe ser mayor a 0"); setSubmitting(false); return; }

            const deadlineDateObj = new Date(newGoalData.deadlineDate);
            deadlineDateObj.setHours(23, 59, 59);
            const deadlineTimestamp = Timestamp.fromDate(deadlineDateObj);

            const goalDoc = {
                name: newGoalData.name,
                current: 0,
                total: parseFloat(finalTotal.toFixed(2)),
                unit: newGoalData.unit,
                deadline: deadlineTimestamp,
                createdAt: serverTimestamp()
            };

            // --- TRUCO OFFLINE ---
            await quickSave(addDoc(collection(db, 'users', userId, 'goals'), goalDoc));
            
            setNewGoalData({ name: '', unit: 'Libros', totalQty: 1, hours: 0, minutes: 0, deadlineDate: '' });
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    // --- AUXILIARES ---
    const deleteGoal = async (id: string) => {
        if (!userId || !window.confirm('¿Borrar meta?')) return;
        try { await deleteDoc(doc(db, 'users', userId, 'goals', id)); } catch (error) { console.error(error); }
    };

    const updateManualProgress = async (goal: Goal, increment: number) => {
        if (!userId) return;
        const newCurrent = Math.max(0, goal.current + increment);
        try { await updateDoc(doc(db, 'users', userId, 'goals', goal.id), { current: newCurrent }); } catch (error) { console.error(error); }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewGoalData(prev => ({ ...prev, [name]: value }));
    };

    const getGoalStatus = (goal: Goal, isCompleted: boolean) => {
        const now = new Date();
        const deadline = goal.deadline?.toDate ? goal.deadline.toDate() : new Date();
        const timeDiff = deadline.getTime() - now.getTime();
        const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

        if (isCompleted) return { color: 'bg-yellow-50 border-yellow-200', badgeColor: 'bg-yellow-100 text-yellow-700', text: '¡Completado!', icon: Trophy };
        if (daysLeft < 0) return { color: 'bg-red-50 border-red-200', badgeColor: 'bg-red-100 text-red-700', text: `Vencido hace ${Math.abs(daysLeft)} días`, icon: AlertTriangle };
        if (daysLeft <= 3) return { color: 'bg-orange-50 border-orange-200', badgeColor: 'bg-orange-100 text-orange-700', text: `${daysLeft} días restantes (¡Cerca!)`, icon: Clock };
        return { color: 'bg-white border-gray-100', badgeColor: 'bg-blue-50 text-blue-600', text: `${daysLeft} días restantes`, icon: Calendar };
    };

    return (
        <div className="min-h-screen bg-gray-50/50 p-4 pb-24 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                
                <div className="flex flex-col gap-2 mb-6">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 flex items-center gap-2">
                        <Trophy className="w-7 h-7 text-yellow-500" /> Mis Retos
                    </h2>
                    <p className="text-sm text-gray-500">Define fechas límite y cumple tus objetivos.</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
                ) : goals.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100 flex flex-col items-center">
                        <Target className="w-12 h-12 text-indigo-300 mb-4" />
                        <h3 className="text-lg font-bold text-gray-900">Sin retos activos</h3>
                        <button onClick={() => setIsModalOpen(true)} className="mt-4 text-indigo-600 font-bold hover:underline">Crear reto con fecha límite</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {goals.map((goal) => {
                            const displayCurrent = calculateProgress(goal);
                            const isAutomated = ['Libros', 'Páginas', 'Horas'].includes(goal.unit);
                            const percent = Math.min(100, Math.max(0, (displayCurrent / goal.total) * 100));
                            const isCompleted = displayCurrent >= goal.total;
                            const status = getGoalStatus(goal, isCompleted);
                            const StatusIcon = status.icon;

                            return (
                                <div key={goal.id} className={`${status.color} border-2 rounded-2xl p-5 shadow-sm relative overflow-hidden group transition-all`}>
                                    <div className="absolute bottom-0 left-0 h-1.5 bg-gray-200/50 w-full">
                                        <div className={`h-full transition-all duration-700 ${isCompleted ? 'bg-yellow-500' : 'bg-indigo-600'}`} style={{ width: `${percent}%` }} />
                                    </div>
                                    <div className="flex justify-between items-start mb-3 relative z-10">
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg leading-tight">{goal.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider bg-white/60 px-2 py-0.5 rounded-md border border-gray-200/50">{goal.unit}</span>
                                                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${status.badgeColor}`}>
                                                    <StatusIcon className="w-3 h-3" /> {status.text}
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => deleteGoal(goal.id)} className="text-gray-400 hover:text-red-500 bg-white/50 p-1.5 rounded-full"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                    <div className="flex items-end justify-between mb-4 relative z-10 mt-4">
                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-3xl font-black ${isCompleted ? 'text-yellow-600' : 'text-gray-900'}`}>{displayCurrent}</span>
                                            <span className="text-sm text-gray-500 font-bold">/ {goal.total}</span>
                                        </div>
                                        <div className="text-right"><span className="text-2xl font-bold text-indigo-600 opacity-20 group-hover:opacity-100 transition-opacity">{percent.toFixed(0)}%</span></div>
                                    </div>
                                    {!isAutomated && (
                                        <div className="grid grid-cols-2 gap-3 relative z-10">
                                            <button onClick={() => updateManualProgress(goal, -1)} disabled={goal.current <= 0 || isCompleted} className="flex items-center justify-center py-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 active:scale-95 transition-transform"><Minus className="w-4 h-4" /></button>
                                            <button onClick={() => updateManualProgress(goal, 1)} disabled={isCompleted} className="flex items-center justify-center py-2 rounded-xl bg-indigo-600 text-white shadow-md active:scale-95 transition-transform disabled:opacity-50 disabled:bg-gray-400"><Plus className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                    {isAutomated && (
                                        <div className="flex items-center justify-center gap-2 text-xs text-gray-400 font-medium py-2 bg-black/5 rounded-lg"><RefreshCw className="w-3 h-3" /> Sincronizado ({new Date(goal.createdAt?.toDate ? goal.createdAt.toDate() : new Date()).toLocaleDateString()})</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <button onClick={() => setIsModalOpen(true)} className="fixed bottom-24 right-6 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-all z-40"><PlusCircle className="w-7 h-7" /></button>
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center"><h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-600" /> Nuevo Reto</h3><button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-gray-400"/></button></div>
                        <form onSubmit={handleCreateGoal} className="p-6 space-y-5">
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Meta</label><select name="unit" value={newGoalData.unit} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none appearance-none"><option value="Libros">📚 Libros (Auto)</option><option value="Páginas">📄 Páginas (Auto)</option><option value="Horas">⏱️ Horas (Auto)</option><option value="Capítulos">📑 Capítulos (Manual)</option></select></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Nombre del Objetivo</label><input type="text" name="name" value={newGoalData.name} onChange={handleInputChange} placeholder="Ej: Leer 500 páginas" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" /></div>
                            {newGoalData.unit === 'Horas' ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Horas</label><input type="number" inputMode="numeric" name="hours" value={newGoalData.hours} onChange={handleInputChange} min="0" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 font-bold text-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" /></div>
                                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Minutos</label><input type="number" inputMode="numeric" name="minutes" value={newGoalData.minutes} onChange={handleInputChange} min="0" max="59" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 font-bold text-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" /></div>
                                </div>
                            ) : (
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Cantidad Total ({newGoalData.unit})</label><input type="number" inputMode="numeric" name="totalQty" value={newGoalData.totalQty} onChange={handleInputChange} min="1" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 font-bold text-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" /></div>
                            )}
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Fecha Límite</label><div className="relative"><input type="date" name="deadlineDate" value={newGoalData.deadlineDate} onChange={handleInputChange} min={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" /><Calendar className="w-5 h-5 text-gray-400 absolute right-4 top-3.5 pointer-events-none" /></div></div>
                            <button type="submit" disabled={submitting || !newGoalData.deadlineDate || !newGoalData.name} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-indigo-700 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Guardando...' : 'Comenzar Reto'}</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MetasPage;