import React, { useState, useEffect } from "react";
import OfflineBanner from "../components/OfflineBanner";
import { collection, addDoc, onSnapshot, query, where, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { registrarLog } from "../utils/log";

const Entradas = () => {
  const { funcionario, loja } = useAuth();
  const [produtos, setProdutos] = useState([]);
  const [itens, setItens] = useState([{ produto: "", quantidade: 1 }]);
  const [origem, setOrigem] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [entradas, setEntradas] = useState([]);

  useEffect(() => {
    if (!loja) return;
    const qProdutos = query(collection(db, "produtos"), where("loja", "==", loja.nome));
    const unsubscribeProdutos = onSnapshot(qProdutos, (snapshot) => {
      setProdutos(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    const qEntradas = query(collection(db, "entradas"), where("destino", "==", loja.nome));
    const unsubscribeEntradas = onSnapshot(qEntradas, (snapshot) => {
      setEntradas(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsubscribeProdutos();
      unsubscribeEntradas();
    };
  }, [loja]);

  const handleItemChange = (idx, field, value) => {
    setItens((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };
  const handleAddItem = () => setItens((prev) => [...prev, { produto: "", quantidade: 1 }]);
  const handleRemoveItem = (idx) => setItens((prev) => prev.filter((_, i) => i !== idx));

  const handleEntrada = async (e) => {
    e.preventDefault();
    if (itens.some(item => !item.produto || !item.quantidade || item.quantidade <= 0)) {
      setMensagem("Preencha todos os campos dos itens corretamente.");
      return;
    }
    setSalvando(true);
    try {
      for (const item of itens) {
        // Atualiza estoque da loja atual
        const prodRef = doc(db, "produtos", item.produto);
        const prodSnap = produtos.find(p => p.id === item.produto);
        if (!prodSnap) {
          setMensagem(`Produto não encontrado.`);
          setSalvando(false);
          return;
        }
        await updateDoc(prodRef, { quantidade: prodSnap.quantidade + Number(item.quantidade) });
      }
      // Registra entrada
      await addDoc(collection(db, "entradas"), {
        destino: loja.nome,
        origem: origem || "-",
        itens: itens.map(item => ({ produto: produtos.find(p => p.id === item.produto)?.nome || "", quantidade: Number(item.quantidade) })),
        usuario: funcionario?.nome || "-",
        dataHora: new Date().toISOString()
      });
      await registrarLog({
        acao: "entrada",
        alvo: "estoque",
        usuario: funcionario?.nome || "-",
        loja: loja.nome,
        detalhes: { origem: origem || "-", itens: itens.map(item => ({ produto: produtos.find(p => p.id === item.produto)?.nome || "", quantidade: Number(item.quantidade) })) }
      });
      setMensagem("Entrada registrada com sucesso!");
      setItens([{ produto: "", quantidade: 1 }]);
      setOrigem("");
    } catch (e) {
      setMensagem("Erro ao registrar entrada: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <div className="flex-1 w-full max-w-2xl mx-auto p-2 sm:p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6 text-blue-300 text-center sm:text-left">Entradas de Estoque</h1>
        <OfflineBanner />
        <form className="bg-gray-800 p-4 rounded-lg shadow-lg mb-8" onSubmit={handleEntrada}>
          <div className="mb-4">
            <label className="block mb-1 font-semibold text-blue-200">Origem (opcional)</label>
            <input className="p-2 rounded text-black w-full" value={origem} onChange={e => setOrigem(e.target.value)} placeholder="Fornecedor, doação, etc" />
          </div>
          <div className="mb-4">
            <label className="block mb-1 font-semibold text-blue-200">Itens a receber</label>
            {itens.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <select className="p-2 rounded text-black flex-1" value={item.produto} onChange={e => handleItemChange(idx, "produto", e.target.value)}>
                  <option value="">Produto</option>
                  {produtos.map(p => (
                    <option key={p.id} value={p.id}>{p.nome} (Qtd: {p.quantidade})</option>
                  ))}
                </select>
                <input type="number" min="1" className="p-2 rounded text-black w-24" value={item.quantidade} onChange={e => handleItemChange(idx, "quantidade", e.target.value)} />
                {itens.length > 1 && <button type="button" className="bg-red-600 px-2 rounded text-white font-bold" onClick={() => handleRemoveItem(idx)}>X</button>}
              </div>
            ))}
            <button type="button" className="bg-blue-700 px-3 py-1 rounded text-white font-bold mt-2" onClick={handleAddItem}>Adicionar item</button>
          </div>
          <button type="submit" className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-bold text-white" disabled={salvando}>{salvando ? "Registrando..." : "Registrar Entrada"}</button>
          {mensagem && <div className="mt-4 text-center text-yellow-300 font-bold">{mensagem}</div>}
        </form>
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-blue-200">Últimas Entradas</h2>
            <a href="/todas-entradas" className="text-blue-400 hover:underline text-sm font-bold">Ver todas entradas</a>
          </div>
          <ul className="divide-y divide-gray-700">
            {entradas.slice(0,10).map((t) => (
              <li key={t.id} className="py-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {t.itens.map((i, idx) => (
                      <span key={idx} className="bg-gray-900 rounded px-2 py-1 text-blue-200 font-bold flex items-center text-sm mb-1">
                        {i.produto} <span className="ml-2 text-blue-400 font-normal">x {i.quantidade}</span>
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-col md:items-end text-xs mt-2 md:mt-0">
                    <span className="text-blue-200">Origem: {t.origem || '-'}</span>
                    <span className="text-blue-200">Usuário: {t.usuario}</span>
                    <span className="text-gray-400">{new Date(t.dataHora).toLocaleString()}</span>
                  </div>
                </div>
              </li>
            ))}
            {entradas.length === 0 && <li className="text-gray-400">Nenhuma entrada registrada.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Entradas;
