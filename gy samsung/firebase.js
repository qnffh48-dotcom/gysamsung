import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
doc,
setDoc,
getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCXFjab185jXoEUeQya3EEMiKJiDtQ9mTw",
  authDomain: "gysamsung-22507.firebaseapp.com",
  projectId: "gysamsung-22507",
  storageBucket: "gysamsung-22507.firebasestorage.app",
  messagingSenderId: "64748299825",
  appId: "1:64748299825:web:3611bc400e5e4120bed710"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, doc, setDoc, getDoc };