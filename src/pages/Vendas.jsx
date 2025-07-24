import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, deleteDoc, doc, updateDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

const Vendas = () => {
  const { loja } = useAuth();
  const [vendas, setVendas] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [editandoVenda, setEditandoVenda] = useState(null);
  const [vendasExcluindo, setVendasExcluindo] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`vendasExcluindo_${loja?.nome}`)) || [];
    } catch {
      return [];
    }
  });

  function setVendasExcluindoPersistidas(loja, arr) {
    localStorage.setItem(`vendasExcluindo_${loja?.nome}`, JSON.stringify(arr));
  }

  useEffect(() => {
    if (!loja) return;
    const q = query(collection(db, "vendas"), where("loja", "==", loja.nome));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const excluindo = JSON.parse(localStorage.getItem(`vendasExcluindo_${loja?.nome}`)) || [];
      setVendas(lista.filter(v => !excluindo.includes(v.id)).sort((a, b) => new Date(b.data) - new Date(a.data)));
    });
    return () => unsubscribe();
  }, [loja]);

  const iniciarEdicao = (venda) => {
    setEditandoId(venda.id);
    setEditandoVenda({ ...venda });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setEditandoVenda(null);
  };

  const salvarEdicao = async () => {
    if (!editandoId) return;
    try {
      // Busca venda original para restaurar estoque
      const vendaOriginal = vendas.find(v => v.id === editandoId);
      if (vendaOriginal) {
        for (let item of vendaOriginal.itens) {
          const produtosSnap = await getDocs(query(collection(db, "produtos"), where("loja", "==", loja.nome), where("nome", "==", item.produto)));
          produtosSnap.forEach(async (docu) => {
            const produto = docu.data();
            await updateDoc(doc(db, "produtos", docu.id), {
              quantidade: produto.quantidade + item.quantidade
            });
          });
        }
      }
      // Debita estoque dos novos itens
      for (let item of editandoVenda.itens) {
        const produtosSnap = await getDocs(query(collection(db, "produtos"), where("loja", "==", loja.nome), where("nome", "==", item.produto)));
        produtosSnap.forEach(async (docu) => {
          const produto = docu.data();
          await updateDoc(doc(db, "produtos", docu.id), {
            quantidade: produto.quantidade - item.quantidade
          });
        });
      }
      await updateDoc(doc(db, "vendas", editandoId), editandoVenda);
      setEditandoId(null);
      setEditandoVenda(null);
    } catch (e) {
      alert("Erro ao salvar edição da venda.");
    }
  };

  const excluirVenda = async (id) => {
    if (!window.confirm("Deseja mesmo excluir esta venda?")) return;
    const excluindoAtual = JSON.parse(localStorage.getItem(`vendasExcluindo_${loja?.nome}`)) || [];
    if (excluindoAtual.includes(id)) return;
    setVendasExcluindo((prev) => [...prev, id]);
    setVendasExcluindoPersistidas(loja, [...excluindoAtual, id]);
    setVendas((prev) => prev.filter((v) => v.id !== id));
    try {
      // Restaurar estoque dos itens da venda
      const venda = vendas.find(v => v.id === id);
      if (venda) {
        for (let item of venda.itens) {
          const produtosSnap = await getDocs(query(collection(db, "produtos"), where("loja", "==", loja.nome), where("nome", "==", item.produto)));
          produtosSnap.forEach(async (docu) => {
            const produto = docu.data();
            await updateDoc(doc(db, "produtos", docu.id), {
              quantidade: produto.quantidade + item.quantidade
            });
          });
        }
      }
      await deleteDoc(doc(db, "vendas", id));
      if (editandoId === id) cancelarEdicao();
    } catch (e) {
      alert("Erro ao excluir venda: " + (e && e.message ? e.message : e));
    } finally {
      setVendasExcluindo((prev) => prev.filter((vid) => vid !== id));
      const atual = (JSON.parse(localStorage.getItem(`vendasExcluindo_${loja?.nome}`)) || []).filter((vid) => vid !== id);
      setVendasExcluindoPersistidas(loja, atual);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <div className="flex-1 w-full max-w-4xl mx-auto p-2 sm:p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6 text-blue-300 text-center sm:text-left">Vendas</h1>
        <div className="bg-gray-800 p-2 sm:p-6 rounded-lg shadow-lg overflow-x-auto">
          <ul className="divide-y divide-gray-700">
            {vendas.map((venda) => (
              <li key={venda.id} className="py-3">
                {editandoId === venda.id ? (
                  <div className="bg-gray-900 p-4 rounded-lg flex flex-col gap-2 shadow-lg">
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        className="text-black p-1 rounded w-32"
                        value={editandoVenda.vendedor}
                        onChange={e => setEditandoVenda({ ...editandoVenda, vendedor: e.target.value })}
                      />
                      <input
                        type="datetime-local"
                        className="text-black p-1 rounded w-48"
                        value={editandoVenda.data ? editandoVenda.data.slice(0, 16) : ""}
                        onChange={e => setEditandoVenda({ ...editandoVenda, data: e.target.value })}
                      />
                      <input
                        type="text"
                        className="text-black p-1 rounded w-48"
                        value={editandoVenda.observacao || ""}
                        onChange={e => setEditandoVenda({ ...editandoVenda, observacao: e.target.value })}
                        placeholder="Observação"
                      />
                    </div>
                    <div className="flex flex-col gap-2 mt-2">
                      <span className="text-blue-200 font-bold">Itens:</span>
                      {editandoVenda.itens.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            type="text"
                            className="p-1 rounded text-black w-32"
                            value={item.produto}
                            onChange={e => {
                              const novos = [...editandoVenda.itens];
                              novos[idx].produto = e.target.value;
                              setEditandoVenda({ ...editandoVenda, itens: novos });
                            }}
                          />
                          <input
                            type="number"
                            className="p-1 rounded text-black w-20"
                            value={item.quantidade}
                            onChange={e => {
                              const novos = [...editandoVenda.itens];
                              novos[idx].quantidade = Number(e.target.value);
                              setEditandoVenda({ ...editandoVenda, itens: novos });
                            }}
                            min={1}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 mt-2">
                      <span className="text-blue-200 font-bold">Pagamentos:</span>
                      {editandoVenda.pagamentos.map((pag, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <select
                            className="p-1 rounded text-black w-32"
                            value={pag.forma}
                            onChange={e => {
                              const novos = [...editandoVenda.pagamentos];
                              novos[idx].forma = e.target.value;
                              setEditandoVenda({ ...editandoVenda, pagamentos: novos });
                            }}
                          >
                            <option value="dinheiro">Dinheiro</option>
                            <option value="pix">Pix</option>
                            <option value="credito">Crédito</option>
                            <option value="debito">Débito</option>
                          </select>
                          <input
                            type="number"
                            className="p-1 rounded text-black w-20"
                            value={pag.valor}
                            onChange={e => {
                              const novos = [...editandoVenda.pagamentos];
                              novos[idx].valor = e.target.value;
                              setEditandoVenda({ ...editandoVenda, pagamentos: novos });
                            }}
                            min={0}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={salvarEdicao} className="bg-green-600 px-3 py-1 rounded font-bold text-white flex-1">Salvar</button>
                      <button onClick={cancelarEdicao} className="bg-gray-500 px-3 py-1 rounded font-bold text-white flex-1">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-900 p-4 rounded-lg flex flex-col gap-2 shadow-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className="font-bold text-lg text-blue-200">{venda.vendedor}</span>
                      <div className="flex flex-wrap gap-4 text-gray-400 text-sm">
                        <span>{new Date(venda.data).toLocaleString()}</span>
                        <span>Itens: {venda.itens.map(i => `${i.produto} (${i.quantidade})`).join(", ")}</span>
                        <span>Pagamentos: {venda.pagamentos.map(p => `${p.forma}: R$${p.valor}`).join(", ")}</span>
                        {venda.observacao && <span className="text-yellow-300">Obs: {venda.observacao}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => iniciarEdicao(venda)} className="bg-yellow-500 px-3 py-1 rounded font-bold flex-1">Editar</button>
                      <button onClick={() => excluirVenda(venda.id)} className="bg-red-600 px-3 py-1 rounded font-bold flex-1">Excluir</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Vendas;
