import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";

// Exporta todos os dados do Firestore para um JSON (admin manual)
export async function exportarBackupFirestore() {
  const colecoes = ["lojas", "funcionarios", "produtos", "vendas", "logs"];
  const backup = {};
  for (const col of colecoes) {
    const snap = await getDocs(collection(db, col));
    backup[col] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  // Download do JSON
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-firestore-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
