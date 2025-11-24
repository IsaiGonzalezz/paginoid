'use client';

import React, { useState } from 'react';
import { db } from '@/app/firebase/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from './AuthProvider';
import { Hash } from 'lucide-react';

interface AddBookFormProps {
    onSuccess: () => void;
}

const timeoutPromise = (ms: number, promise: Promise<any>) => {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            // Si tarda mucho, asumimos que se guardó en local (Optimistic UI) 
            // O lanzamos un error controlado si prefieres ser estricto.
            // Para PWA "Offline First", resolvemos como éxito.
            console.log("⏳ Tiempo de espera agotado, asumiendo guardado offline...");
            resolve("offline-success");
        }, ms);

        promise.then(
            (res) => {
                clearTimeout(timeoutId);
                resolve(res);
            },
            (err) => {
                clearTimeout(timeoutId);
                reject(err);
            }
        );
    });
};

const AddBookForm: React.FC<AddBookFormProps> = ({ onSuccess }) => {
    const { userId } = useAuth();

    // Estados
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [totalPages, setTotalPages] = useState('');
    const [status, setStatus] = useState('Por Leer');

    // Estados ocultos
    const [rating] = useState(0);
    const [review] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!userId) return;

        if (!title.trim() || !author.trim() || !totalPages) {
            setError('Todos los campos marcados son obligatorios.');
            setLoading(false);
            return;
        }

        try {
            const pagesNumber = parseInt(totalPages, 10);
            if (isNaN(pagesNumber) || pagesNumber <= 0) {
                setError('El número de páginas debe ser válido.');
                setLoading(false);
                return;
            }

            const newBook = {
                title: title.trim(),
                author: author.trim(),
                status,
                rating,
                review,
                createdAt: new Date().toISOString(),
                totalPages: pagesNumber,
                currentPage: 0,
            };

            const newBookRef = doc(db, 'users', userId, 'userBooks', new Date().getTime().toString());
            await timeoutPromise(3000, setDoc(newBookRef, newBook));


            onSuccess();
            setTitle('');
            setAuthor('');
            setTotalPages('');
            setStatus('Por Leer');

        } catch (err:any) {
            console.error(err);
            // Si el error es específicamente de permisos o cuota, sí lo mostramos
            if (err.code === 'permission-denied') {
                setError('No tienes permiso para guardar.');
            } else {
                // Si es error de red "failed-precondition", en teoría la persistencia debería evitarlo,
                // pero si salta, podemos decirle al usuario que se guardará luego.
                // Para este caso, lo trataremos como un éxito diferido.
                onSuccess(); // Cerramos modal asumiendo éxito offline
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-2 md:p-4 space-y-5">
            <div className="space-y-4">
                {/* Título */}
                <div className="group">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Título del Libro *</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        // CORRECCIÓN: text-gray-900 fuerza el color negro
                        className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                        placeholder="Ej. El Principito"
                        required
                    />
                </div>

                {/* Autor */}
                <div className="group">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Autor *</label>
                    <input
                        type="text"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        // CORRECCIÓN: text-gray-900
                        className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                        placeholder="Ej. Antoine de Saint-Exupéry"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Páginas Totales */}
                    <div className="group">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Páginas *</label>
                        <div className="relative">
                            <input
                                type="number"
                                inputMode="numeric"
                                value={totalPages}
                                onChange={(e) => setTotalPages(e.target.value)}
                                // CORRECCIÓN: text-gray-900
                                className="block w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                                placeholder="0"
                                required
                            />
                            <Hash className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                        </div>
                    </div>

                    {/* Estado */}
                    <div className="group">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Estado</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            // CORRECCIÓN: text-gray-900 y bg-gray-50
                            className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 outline-none appearance-none"
                        >
                            <option value="Por Leer">📅 Por Leer</option>
                            <option value="Leyendo">📖 Leyendo</option>
                            <option value="Leído">✅ Leído</option>
                        </select>
                    </div>
                </div>
            </div>

            {error && <p className="text-red-600 text-sm text-center bg-red-50 p-2 rounded-lg font-medium">{error}</p>}

            <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg active:scale-95 transition-all"
            >
                {loading ? 'Guardando...' : 'Guardar Libro'}
            </button>
        </form>
    );
};

export default AddBookForm;