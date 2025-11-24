'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

type AuthContextType = {
    user: User | null;
    userId: string | null;
    userName: string | null; // Nuevo campo para el nombre
    loading: boolean;
    isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    userId: null,
    userName: null,
    loading: true,
    isAuthenticated: false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userName, setUserName] = useState<string | null>(null); // Estado para el nombre
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                // Si el usuario está logueado, carga su nombre desde Firestore
                const userDocRef = doc(db, 'users', currentUser.uid);
                try {
                    const docSnap = await getDoc(userDocRef);
                    if (docSnap.exists()) {
                        setUserName(docSnap.data().name || null);
                    } else {
                        // Esto podría ocurrir si el usuario se registra pero falla el setDoc,
                        // o si usa un método de inicio de sesión sin nombre inicial (ej: anónimo).
                        setUserName(currentUser.email || 'Usuario');
                    }
                } catch (error) {
                    console.error("Error al obtener perfil de Firestore:", error);
                    setUserName(currentUser.email || 'Usuario'); // Fallback en caso de error
                }
            } else {
                setUserName(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const isAuthenticated = !!user;
    const userId = user?.uid || null;

    return (
        <AuthContext.Provider value={{ user, userId, userName, loading, isAuthenticated }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
