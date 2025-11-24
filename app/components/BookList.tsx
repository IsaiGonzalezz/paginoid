'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/app/firebase/firebaseConfig';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthProvider';
import { Trash2, Edit3, Book, X, Save } from 'lucide-react';

// Tipos
interface BookData {
    id: string;
    title: string;
    author: string;
    status: string;
    totalPages: number;
    currentPage: number;
    finishedAt?: any; // Nuevo campo para saber cuándo se terminó
}

interface BookListProps {
    currentTab: string;
}

const BookList: React.FC<BookListProps> = ({ currentTab }) => {
    const { userId } = useAuth();
    const [books, setBooks] = useState<BookData[]>([]);
    const [loading, setLoading] = useState(true);

    // Estado para el Modal
    const [editingBook, setEditingBook] = useState<BookData | null>(null);
    const [tempPage, setTempPage] = useState(0);

    // 1. LEER LIBROS
    useEffect(() => {
        if (!userId) return;

        const q = query(
            collection(db, 'users', userId, 'userBooks'),
            where('status', '==', currentTab)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const booksData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as BookData[];
            setBooks(booksData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId, currentTab]);

    // 2. ELIMINAR
    const handleDelete = async (bookId: string) => {
        if (!userId) return;
        if (confirm('¿Eliminar este libro y su progreso?')) {
            try {
                await deleteDoc(doc(db, 'users', userId, 'userBooks', bookId));
            } catch (error) {
                console.error(error);
            }
        }
    };

    // 3. ABRIR MODAL
    const openProgressModal = (book: BookData) => {
        setEditingBook(book);
        setTempPage(book.currentPage || 0);
    };

    // 4. GUARDAR Y ACTUALIZAR ESTADO CON FECHAS
    const saveProgress = async () => {
        if (!userId || !editingBook) return;
        
        let newStatus = editingBook.status;
        const total = editingBook.totalPages || 1;
        
        // Datos a actualizar base
        const updateData: any = {
            currentPage: tempPage
        };

        // LÓGICA DE ESTADOS AUTOMÁTICA
        
        // A) Cambiar a 'Leyendo'
        if (editingBook.status === 'Por Leer' && tempPage > 0 && tempPage < total) {
            newStatus = 'Leyendo';
        }

        // B) Cambiar a 'Leído' y guardar FECHA
        if (tempPage >= total) {
            newStatus = 'Leído';
            // Solo guardamos la fecha si NO estaba leído antes (para no sobrescribir la fecha original si editas luego)
            if (editingBook.status !== 'Leído') {
                updateData.finishedAt = serverTimestamp();
            }
        }

        // C) Regresar a 'Por Leer' (opcional)
        if (tempPage === 0 && editingBook.status === 'Leyendo') {
            newStatus = 'Por Leer';
        }
        
        updateData.status = newStatus;

        try {
            const bookRef = doc(db, 'users', userId, 'userBooks', editingBook.id);
            await updateDoc(bookRef, updateData);
            setEditingBook(null); 
        } catch (error) {
            console.error("Error guardando:", error);
        }
    };

    // CÁLCULO CÍRCULO
    const radius = 70;
    const circumference = 2 * Math.PI * radius;

    const getStrokeOffset = (current: number, total: number) => {
        const percent = Math.min(100, Math.max(0, (current / total) * 100));
        return circumference - (percent / 100) * circumference;
    };

    if (loading) return <div className="text-center p-10 text-gray-500 animate-pulse">Cargando...</div>;

    if (books.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 mt-4">
                <Book className="w-10 h-10 text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm font-medium">Vacío: {currentTab}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4 pb-24">
            {books.map((book) => {
                const percent = Math.round(((book.currentPage || 0) / (book.totalPages || 1)) * 100);
                
                return (
                    <div key={book.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group active:scale-[0.99] transition-transform duration-200">
                        <div className="flex-1 min-w-0 pr-4">
                            <h3 className="font-bold text-gray-900 truncate text-lg">{book.title}</h3>
                            <p className="text-sm text-gray-500 mb-3">{book.author}</p>
                            
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percent}%` }}></div>
                                </div>
                                <span className="text-xs font-bold text-indigo-600 w-8 text-right">{percent}%</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Pág {book.currentPage} / {book.totalPages}</p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={() => openProgressModal(book)}
                                className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 active:bg-indigo-200 transition-colors"
                            >
                                <Edit3 className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => handleDelete(book.id)}
                                className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 active:bg-red-200 transition-colors"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                );
            })}

            {/* MODAL FLOTANTE */}
            {editingBook && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setEditingBook(null)}></div>
                    
                    <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900 truncate max-w-[200px]">{editingBook.title}</h3>
                            <button onClick={() => setEditingBook(null)} className="p-1 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"><X className="w-5 h-5"/></button>
                        </div>

                        <div className="flex flex-col items-center justify-center mb-8">
                            <div className="relative w-48 h-48">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                                    <circle cx="80" cy="80" r={radius} className="text-gray-100" strokeWidth="12" stroke="currentColor" fill="transparent" />
                                    <circle cx="80" cy="80" r={radius} className="text-indigo-600 transition-all duration-500 ease-out" strokeWidth="12" strokeLinecap="round" stroke="currentColor" fill="transparent" strokeDasharray={circumference} strokeDashoffset={getStrokeOffset(tempPage, editingBook.totalPages || 1)} />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-4xl font-black text-gray-900">{Math.round((tempPage / (editingBook.totalPages || 1)) * 100)}%</span>
                                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Completado</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <input type="range" min="0" max={editingBook.totalPages || 1} value={tempPage} onChange={(e) => setTempPage(Number(e.target.value))} className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                            <div className="flex items-center justify-center gap-3">
                                <label className="text-sm font-medium text-gray-600">Página:</label>
                                <input type="number" inputMode="numeric" value={tempPage} onChange={(e) => { const val = Math.min(editingBook.totalPages || 1, Math.max(0, Number(e.target.value))); setTempPage(val); }} className="w-24 p-2 bg-gray-50 border border-gray-300 rounded-lg text-center font-bold text-xl text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
                                <span className="text-sm font-medium text-gray-400">/ {editingBook.totalPages}</span>
                            </div>
                        </div>

                        <button onClick={saveProgress} className="w-full mt-8 bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                            <Save className="w-5 h-5" />
                            {tempPage >= (editingBook.totalPages || 1) ? 'Finalizar Libro' : 'Guardar Progreso'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookList;