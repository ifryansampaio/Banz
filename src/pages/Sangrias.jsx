
import React, { useState, useEffect } from "react";
import { collection, addDoc, query, where, orderBy, getDocs } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";

const Sangrias = () => {
  const { loja, funcionario } = useAuth();
  const [valor, setValor] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loja) return;
    const hojeStr = new Date().toLocaleDateString("en-CA");
    const q = query(
      collection(db, "sangrias"),
      where("loja", "==", loja.nome),
      where("data", "==", hojeStr),
      orderBy("hora", "desc")
    );
    getDocs(q).then((snap) => {
      const arr = [];
      snap.forEach((doc) => arr.push({ id: doc.id, ...doc.data() }));
      setHistorico(arr.slice(0, 10));
    });
  }, [loja]);

  const handleSangria = async (e) => {
    e.preventDefault();
    if (!valor || isNaN(Number(valor)) || Number(valor) <= 0) {
      alert("Informe um valor válido.");
      return;
    }
    if (!destinatario) {
      alert("Informe para quem vai a sangria.");
      return;
    }
    setLoading(true);
    const agora = new Date();
    const hojeStr = agora.toLocaleDateString("en-CA");
    const horaStr = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    await addDoc(collection(db, "sangrias"), {
      loja: loja.nome,
      valor: Number(valor),
      para: destinatario,
      registradoPor: funcionario?.nome || "",
      data: hojeStr,
      hora: horaStr,
      usuarioId: funcionario?.id || "",
    });
    setValor("");
    setDestinatario("");
    setLoading(false);
    // Atualiza histórico
    const q = query(
      collection(db, "sangrias"),
      where("loja", "==", loja.nome),
      where("data", "==", hojeStr),
      orderBy("hora", "desc")
    );
    getDocs(q).then((snap) => {
      const arr = [];
      snap.forEach((doc) => arr.push({ id: doc.id, ...doc.data() }));
      setHistorico(arr.slice(0, 10));
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <div className="flex-1 w-full max-w-2xl mx-auto p-2 sm:p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6 text-blue-300 text-center sm:text-left flex items-center gap-2">
          <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m0 0l-3-3m3 3l3-3M5 12a7 7 0 1114 0 7 7 0 01-14 0z" />
          </svg>
          Sangrias / Puxadores
        </h1>
        <form onSubmit={handleSangria} className="bg-gray-800 p-4 rounded-lg shadow-lg mb-8 flex flex-col gap-3">
          <label className="font-semibold text-blue-200">Destinatário da Sangria</label>
          <input
            type="text"
            className="p-2 rounded text-black"
            value={destinatario}
            onChange={e => setDestinatario(e.target.value)}
            required
          />
          <label className="font-semibold text-blue-200">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="p-2 rounded text-black"
            value={valor}
            onChange={e => setValor(e.target.value)}
            required
          />
          <button
            type="submit"
            className="bg-blue-700 hover:bg-blue-800 text-white rounded p-2 font-bold mt-2"
            disabled={loading}
          >
            Registrar Sangria
          </button>
        </form>
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-red-400">Últimas sangrias do dia</h2>
          <ul className="divide-y divide-gray-700">
            {historico.length === 0 && <li className="text-gray-400">Nenhuma sangria registrada hoje.</li>}
            {historico.map((s) => (
              <li key={s.id} className="py-3">
                <div className="bg-gray-900 p-4 rounded-lg flex flex-col gap-2 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="font-bold text-lg text-blue-200">R$ {s.valor.toFixed(2)}</span>
                    <span className="font-bold text-blue-300">Para: {s.para}</span>
                    <span className="text-xs text-gray-400">Registrado por: {s.registradoPor || '-'}</span>
                    <span className="text-gray-400">{s.hora}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Sangrias;
