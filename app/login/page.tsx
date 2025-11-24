'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/app/firebase/firebaseConfig';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (err: any) {
      setError('Credenciales incorrectas');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white p-6 rounded-xl shadow-lg">
      <h1 className="text-3xl font-extrabold text-blue-600 text-center mb-4">Iniciar Sesión</h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-3 text-gray-600 focus:outline-none transition"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-3 text-gray-600 focus:outline-none transition"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Ingresar
        </button>
      </form>
      {error && <p className="text-red-500 text-center mt-2">{error}</p>}

      <p className="text-center text-sm mt-4 text-gray-600">
        ¿No tienes cuenta?{' '}
        <button
          onClick={() => router.push('/register')}
          className="text-blue-600 hover:underline"
        >
          Regístrate
        </button>
      </p>
    </div>

    </div>
    
  );
}
