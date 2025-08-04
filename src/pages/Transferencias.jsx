import React, { useState, useEffect } from "react";
import OfflineBanner from "../components/OfflineBanner";
import { collection, addDoc, onSnapshot, query, where, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { registrarLog } from "../utils/log";

const Transferencias = () => {
  const { funcionario, loja } = useAuth();
  const [produtos, setProdutos] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [itens, setItens] = useState([{ produto: "", quantidade: 1 }]);
  const [lojaDestino, setLojaDestino] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [transferencias, setTransferencias] = useState([]);

  // Carregar produtos e lojas
  useEffect(() => {
    if (!loja) return;
    const qProdutos = query(collection(db, "produtos"), where("loja", "==", loja.nome));
    const unsubscribeProdutos = onSnapshot(qProdutos, (snapshot) => {
      setProdutos(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    const qLojas = query(collection(db, "lojas"));
    const unsubscribeLojas = onSnapshot(qLojas, (snapshot) => {
      setLojas(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    const qTransf = query(collection(db, "transferencias"), where("origem", "==", loja.nome));
    const unsubscribeTransf = onSnapshot(qTransf, (snapshot) => {
      setTransferencias(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsubscribeProdutos();
      unsubscribeLojas();
      unsubscribeTransf();
    };
  }, [loja]);

  const handleItemChange = (idx, field, value) => {
    setItens((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };
  const handleAddItem = () => setItens((prev) => [...prev, { produto: "", quantidade: 1 }]);
  const handleRemoveItem = (idx) => setItens((prev) => prev.filter((_, i) => i !== idx));

  const handleTransferir = async (e) => {
    e.preventDefault();
    if (!lojaDestino || lojaDestino === loja.nome) {
      setMensagem("Selecione uma loja de destino válida.");
      return;
    }
    if (itens.some(item => !item.produto || !item.quantidade || item.quantidade <= 0)) {
      setMensagem("Preencha todos os campos dos itens corretamente.");
      return;
    }
    setSalvando(true);
    try {
      // Atualiza estoque origem e destino
      for (const item of itens) {
        // Origem: debita
        const prodRef = doc(db, "produtos", item.produto);
        const prodSnap = produtos.find(p => p.id === item.produto);
        if (!prodSnap || prodSnap.quantidade < item.quantidade) {
          setMensagem(`Estoque insuficiente para o produto ${prodSnap?.nome || ""}`);
          setSalvando(false);
          return;
        }
        await updateDoc(prodRef, { quantidade: prodSnap.quantidade - Number(item.quantidade) });
        // Destino: credita (cria se não existir)
        const qDest = query(collection(db, "produtos"), where("loja", "==", lojaDestino), where("nome", "==", prodSnap.nome));
        const destSnap = await (await import("firebase/firestore")).getDocs(qDest);
        if (!destSnap.empty) {
          const destDoc = destSnap.docs[0];
          await updateDoc(doc(db, "produtos", destDoc.id), { quantidade: (destDoc.data().quantidade || 0) + Number(item.quantidade) });
        } else {
          await addDoc(collection(db, "produtos"), {
            nome: prodSnap.nome,
            quantidade: Number(item.quantidade),
            precoMin: prodSnap.precoMin || 0,
            precoMax: prodSnap.precoMax || 0,
            loja: lojaDestino
          });
        }
      }
      // Registra transferência
      await addDoc(collection(db, "transferencias"), {
        origem: loja.nome,
        destino: lojaDestino,
        itens: itens.map(item => ({ produto: produtos.find(p => p.id === item.produto)?.nome || "", quantidade: Number(item.quantidade) })),
        usuario: funcionario?.nome || "-",
        dataHora: new Date().toISOString()
      });

      // Registra entrada na loja de destino
      await addDoc(collection(db, "entradas"), {
        destino: lojaDestino,
        origem: loja.nome,
        itens: itens.map(item => ({ produto: produtos.find(p => p.id === item.produto)?.nome || "", quantidade: Number(item.quantidade) })),
        usuario: funcionario?.nome || "-",
        dataHora: new Date().toISOString()
      });

      await registrarLog({
        acao: "transferir",
        alvo: "estoque",
        usuario: funcionario?.nome || "-",
        loja: loja.nome,
        detalhes: { destino: lojaDestino, itens: itens.map(item => ({ produto: produtos.find(p => p.id === item.produto)?.nome || "", quantidade: Number(item.quantidade) })) }
      });
      setMensagem("Transferência realizada com sucesso!");
      setItens([{ produto: "", quantidade: 1 }]);
      setLojaDestino("");
    } catch (e) {
      setMensagem("Erro ao transferir: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <div className="flex-1 w-full max-w-2xl mx-auto p-2 sm:p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6 text-blue-300 text-center sm:text-left">Transferências de Estoque</h1>
        <OfflineBanner />
        <form className="bg-gray-800 p-4 rounded-lg shadow-lg mb-8" onSubmit={handleTransferir}>
          <div className="mb-4">
            <label className="block mb-1 font-semibold text-blue-200">Loja de destino</label>
            <select className="p-2 rounded text-black w-full" value={lojaDestino} onChange={e => setLojaDestino(e.target.value)}>
              <option value="">Selecione a loja</option>
              {lojas.filter(l => l.nome !== loja?.nome).map(l => (
                <option key={l.id} value={l.nome}>{l.nome}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block mb-1 font-semibold text-blue-200">Itens a transferir</label>
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
          <button type="submit" className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-bold text-white" disabled={salvando}>{salvando ? "Transferindo..." : "Transferir"}</button>
          {mensagem && <div className="mt-4 text-center text-yellow-300 font-bold">{mensagem}</div>}
        </form>
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-blue-200">Últimas Transferências</h2>
            <a href="/todas-transferencias" className="text-blue-400 hover:underline text-sm font-bold">Ver todas transferências</a>
          </div>
          <ul className="divide-y divide-gray-700">
            {transferencias.slice(0,10).map((t) => (
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
                    <span className="text-blue-200">Para: {t.destino}</span>
                    <span className="text-blue-200">Usuário: {t.usuario}</span>
                    <span className="text-gray-400">{new Date(t.dataHora).toLocaleString()}</span>
                  </div>
                </div>
              </li>
            ))}
            {transferencias.length === 0 && <li className="text-gray-400">Nenhuma transferência registrada.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Transferencias;
