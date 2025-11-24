'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/app/firebase/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { UserPlus, User,Lock } from 'lucide-react';

export default function RegisterPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        if (!name.trim()) {
            setError('Por favor, ingresa tu nombre.');
            setLoading(false);
            return;
        }

        try {
            // 1. Crear el usuario en Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Crear el documento de usuario en Firestore (Colección 'users')
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, {
                name: name.trim(),
                email: user.email,
                createdAt: new Date().toISOString(),
            });

            // 3. Redirigir a la página principal
            router.push('/');
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/weak-password') {
                setError('La contraseña debe tener al menos 6 caracteres.');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('El correo electrónico ya está registrado.');
            } else {
                setError('Error al registrar usuario. Verifica el correo y la contraseña.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl">
                <h1 className="text-3xl font-extrabold text-indigo-600 text-center mb-6 flex items-center justify-center">
                    <UserPlus className="w-7 h-7 mr-2" />
                    Crear Cuenta
                </h1>
                
                <form onSubmit={handleRegister} className="space-y-4">
                    {/* Campo Nombre */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Nombre"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-3 pl-10 text-gray-600 focus:outline-none transition"
                            required
                            disabled={loading}
                        />
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    </div>

                    <input
                        type="email"
                        placeholder="Correo electrónico"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-3 text-gray-600 focus:outline-none transition"
                        required
                        disabled={loading}
                    />
                    <input
                        type="password"
                        placeholder="Contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-3 text-gray-600 focus:outline-none transition"
                        required
                        disabled={loading}
                    />
                    
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition shadow-md disabled:bg-indigo-400"
                    >
                        {loading ? 'Registrando...' : 'Crear Cuenta'}
                    </button>
                </form>

                {error && <p className="text-red-500 text-center mt-4 p-2 bg-red-100 rounded-lg">{error}</p>}

                <p className="text-center text-sm mt-6 text-gray-600">
                    ¿Ya tienes cuenta?{' '}
                    <button
                        onClick={() => router.push('/login')}
                        className="text-indigo-600 hover:underline font-medium"
                        disabled={loading}
                    >
                        Inicia sesión
                    </button>
                </p>
            </div>
        </div>
    );
}
