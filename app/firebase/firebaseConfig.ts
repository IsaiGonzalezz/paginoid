import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 1. Inicializar App (Patrón Singleton para Next.js)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// 2. Inicializar Firestore con Persistencia (BLINDADO)
let db : any;

try {
  // Intentamos inicializar con la configuración de caché robusta
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
  console.log(" Firestore inicializado con persistencia (OFFLINE SUPPORT)");
} catch (e) {
  // Si falla (porque ya estaba inicializada), usamos la instancia existente
  // Esto pasa mucho en desarrollo con Next.js
  console.warn(" Usando instancia Firestore existente (Persistencia puede variar según carga inicial)");
  db = getFirestore(app);
}

export { app, auth, db };