import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

// Configuração Firebase - substitua com a sua se necessário
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
const db = getFirestore(app);

const lojas = [
  { nome: "Banca Socorro" }
];

const usuarios = [
  { nome: "ryan", senha: "ry3719", tipo: "pessoa" }
];

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

async function seed() {
  try {
    // Cadastra loja
    for (const loja of lojas) {
      await addDoc(collection(db, "lojas"), loja);
      console.log(`Loja cadastrada: ${loja.nome}`);
    }
    // Cadastra usuário
    for (const user of usuarios) {
      const userData = { ...user, nome: user.nome.toLowerCase() };
      await addDoc(collection(db, "funcionarios"), userData);
      console.log(`Usuário cadastrado: ${capitalize(user.nome)}`);
    }
    console.log("Seed concluído!");
  } catch (error) {
    console.error("Erro ao executar seed:", error);
  }
}

seed();
