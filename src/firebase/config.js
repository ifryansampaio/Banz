import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBsMMgDVmc6XCf_pSGAQAjW7hhqcOKZhDo",
  authDomain: "banz-68297.firebaseapp.com",
  databaseURL: "https://banz-68297-default-rtdb.firebaseio.com",
  projectId: "banz-68297",
  storageBucket: "banz-68297.appspot.com",
  messagingSenderId: "59930577087",
  appId: "1:59930577087:web:468148a7780ecdf1c8de0a",
  measurementId: "G-NCP2W3XF0E"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
