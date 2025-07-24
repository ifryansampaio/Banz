import { collection, getDocs, where, query } from "firebase/firestore";
import { db } from "../firebase/config";

export async function getTotalEstoquePorLoja(lojaNome) {
  const q = query(collection(db, "produtos"), where("loja", "==", lojaNome));
  const snap = await getDocs(q);
  let total = 0;
  snap.forEach(doc => {
    const data = doc.data();
    total += Number(data.quantidade) || 0;
  });
  return total;
}
