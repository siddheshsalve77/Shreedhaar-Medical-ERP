import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBE4tcEEkX61boDbWW_1cBiy9zpRw52XvI",
  authDomain: "shreedhar-medical.firebaseapp.com",
  projectId: "shreedhar-medical",
  storageBucket: "shreedhar-medical.firebasestorage.app",
  messagingSenderId: "489380553620",
  appId: "1:489380553620:web:7584fb5dfecec99c182581"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enable offline persistence (caches data for offline use)
try { 
  enableIndexedDbPersistence(db).catch((err) => {
      if (err.code == 'failed-precondition') {
          console.warn('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
      } else if (err.code == 'unimplemented') {
          console.warn('The current browser does not support all of the features required to enable persistence');
      }
  });
} catch (e) { 
  console.error("Persistence failed", e); 
}