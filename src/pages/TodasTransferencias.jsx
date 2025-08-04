import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

const TodasTransferencias = () => {
  const { loja } = useAuth();
  const [transferencias, setTransferencias] = useState([]);
  const [dataFiltro, setDataFiltro] = useState("");

  useEffect(() => {
    if (!loja) return;
    let q = query(collection(db, "transferencias"), where("origem", "==", loja.nome));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransferencias(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [loja]);

  const transferenciasFiltradas = dataFiltro
    ? transferencias.filter(e => e.dataHora && e.dataHora.slice(0,10) === dataFiltro)
    : transferencias;

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <div className="flex-1 w-full max-w-3xl mx-auto p-2 sm:p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6 text-blue-300 text-center sm:text-left">Todas as Transferências</h1>
        <div className="mb-4 flex gap-2 items-center">
          <label className="font-semibold text-blue-200">Filtrar por data:</label>
          <input type="date" className="p-2 rounded text-black" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} />
          <button className="bg-gray-700 px-3 py-1 rounded text-white font-bold" onClick={()=>setDataFiltro("")}>Limpar</button>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
          <ul className="divide-y divide-gray-700">
            {transferenciasFiltradas.map((t) => (
              <li key={t.id} className="py-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-bold text-blue-200">{t.itens.map(i => i.produto).join(", ")}</span>
                    <span className="text-xs text-gray-400">Qtd: {t.itens.map(i => i.quantidade).join(", ")}</span>
                  </div>
                  <div className="flex flex-col md:items-end">
                    <span className="text-xs text-blue-200">Para: {t.destino}</span>
                    <span className="text-xs text-blue-200">Usuário: {t.usuario}</span>
                    <span className="text-xs text-gray-400">{new Date(t.dataHora).toLocaleString()}</span>
                  </div>
                </div>
              </li>
            ))}
            {transferenciasFiltradas.length === 0 && <li className="text-gray-400">Nenhuma transferência encontrada.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TodasTransferencias;
