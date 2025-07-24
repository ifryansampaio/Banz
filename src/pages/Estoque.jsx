import React, { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { saveLocal, loadLocal, addPendingSync, getPendingSync, removePendingSync } from "../utils/sync";
import { registrarLog } from "../utils/log";

const Estoque = () => {
  const { loja } = useAuth();
  const [produtos, setProdutos] = useState([]);
  const [novoProduto, setNovoProduto] = useState({ nome: "", quantidade: "", precoMin: "", precoMax: "" });
  const [editandoId, setEditandoId] = useState(null);
  const [editandoProduto, setEditandoProduto] = useState({});

  useEffect(() => {
    if (!loja) return;
    // Carregar produtos locais primeiro
    const produtosLocais = loadLocal(`produtos_${loja.nome}`);
    if (produtosLocais.length > 0) setProdutos(produtosLocais);
    // Sincronizar pendentes se online
    if (navigator.onLine) {
      const pendentes = getPendingSync(`produtos_${loja.nome}`);
      pendentes.forEach(async (produto) => {
        try {
          await addDoc(collection(db, "produtos"), produto);
          removePendingSync(`produtos_${loja.nome}`, produto.id);
        } catch {}
      });
    }
    const q = query(collection(db, "produtos"), where("loja", "==", loja.nome));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProdutos(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      saveLocal(`produtos_${loja.nome}`, snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [loja]);

  const registrarMovimentacaoEstoque = async (tipo, produtoAntes, produtoDepois, lojaNome, usuario = "admin") => {
    await addDoc(collection(db, "movimentacoes_estoque"), {
      tipo, // 'adicao', 'edicao', 'exclusao'
      produtoAntes: produtoAntes || null,
      produtoDepois: produtoDepois || null,
      loja: lojaNome,
      usuario,
      dataHora: new Date().toISOString(),
    });
  };

  const adicionarProduto = async () => {
    if (!novoProduto.nome || !novoProduto.quantidade) return alert("Preencha todos os campos!");
    const produtoData = { ...novoProduto, quantidade: parseInt(novoProduto.quantidade, 10), loja: loja.nome };
    try {
      if (navigator.onLine) {
        await addDoc(collection(db, "produtos"), produtoData);
        await registrarMovimentacaoEstoque("adicao", null, produtoData, loja.nome);
      } else {
        addPendingSync(`produtos_${loja.nome}`, produtoData);
        const produtosLocais = loadLocal(`produtos_${loja.nome}`);
        saveLocal(`produtos_${loja.nome}`, [produtoData, ...produtosLocais]);
        // Não registra movimentação offline
      }
      setNovoProduto({ nome: "", quantidade: "", precoMin: "", precoMax: "" });
    } catch (e) {
      console.error("Erro ao adicionar produto:", e);
    }
  };

  const iniciarEdicao = (produto) => {
    setEditandoId(produto.id);
    setEditandoProduto({ ...produto });
  };

  const salvarEdicao = async (id) => {
    try {
      const produtoAntes = produtos.find(p => p.id === id);
      await updateDoc(doc(db, "produtos", id), editandoProduto);
      await registrarMovimentacaoEstoque("edicao", produtoAntes, editandoProduto, loja.nome);
      setEditandoId(null);
    } catch (e) {
      console.error("Erro ao salvar edição:", e);
    }
  };

  const excluirProduto = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este produto?")) {
      // Remove imediatamente da tela
      setProdutos(produtos => produtos.filter(p => p.id !== id));
      try {
        const produtoAntes = produtos.find(p => p.id === id);
        await deleteDoc(doc(db, "produtos", id));
        await registrarMovimentacaoEstoque("exclusao", produtoAntes, null, loja.nome);
        // Após excluir do Firestore, atualiza o localStorage para refletir a exclusão
        const produtosRestantes = loadLocal(`produtos_${loja.nome}`).filter(p => p.id !== id);
        saveLocal(`produtos_${loja.nome}`, produtosRestantes);
      } catch (e) {
        console.error("Erro ao excluir produto:", e);
      }
    }
  };

  window.addEventListener("online", () => {
    if (loja) {
      const pendentes = getPendingSync(`produtos_${loja.nome}`);
      pendentes.forEach(async (produto) => {
        try {
          await addDoc(collection(db, "produtos"), produto);
          removePendingSync(`produtos_${loja.nome}`, produto.id);
        } catch {}
      });
    }
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <div className="flex-1 w-full max-w-4xl mx-auto p-2 sm:p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6 text-blue-300 text-center sm:text-left">Estoque</h1>
        <div className="mb-6 flex gap-2">
          <input
            type="text"
            placeholder="Nome do Produto"
            className="p-3 border text-black rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={novoProduto.nome}
            onChange={(e) => setNovoProduto({ ...novoProduto, nome: e.target.value })}
          />
          <input
            type="number"
            placeholder="Quantidade"
            className="p-3 border text-black rounded w-32 focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={novoProduto.quantidade}
            onChange={(e) => setNovoProduto({ ...novoProduto, quantidade: e.target.value })}
          />
          <input
            type="number"
            placeholder="Preço Mínimo"
            className="p-3 border text-black rounded w-32 focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={novoProduto.precoMin}
            onChange={(e) => setNovoProduto({ ...novoProduto, precoMin: e.target.value })}
          />
          <input
            type="number"
            placeholder="Preço Máximo"
            className="p-3 border text-black rounded w-32 focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={novoProduto.precoMax}
            onChange={(e) => setNovoProduto({ ...novoProduto, precoMax: e.target.value })}
          />
          <button onClick={adicionarProduto} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-bold text-white">Adicionar</button>
        </div>
        <div className="bg-gray-800 p-2 sm:p-6 rounded-lg shadow-lg overflow-x-auto">
          <h2 className="text-xl font-semibold mb-4 text-blue-200">Produtos</h2>
          <ul className="divide-y divide-gray-700">
            {produtos.map((produto) => (
              <li key={produto.id} className="py-3">
                {editandoId === produto.id ? (
                  <div className="bg-gray-900 p-4 rounded-lg flex flex-col gap-2 shadow-lg">
                    <input
                      type="text"
                      className="text-black p-1 rounded w-full mb-2"
                      value={editandoProduto.nome}
                      onChange={e => setEditandoProduto({ ...editandoProduto, nome: e.target.value })}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="text-black p-1 rounded w-full mb-2"
                      value={editandoProduto.quantidade === 0 ? '' : editandoProduto.quantidade}
                      placeholder="Qtd"
                      onChange={e => setEditandoProduto({ ...editandoProduto, quantidade: e.target.value === '' ? '' : Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      pattern="[0-9.]*"
                      className="text-black p-1 rounded w-full mb-2"
                      value={editandoProduto.precoMin}
                      placeholder="Preço Mínimo"
                      onChange={e => setEditandoProduto({ ...editandoProduto, precoMin: e.target.value })}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      pattern="[0-9.]*"
                      className="text-black p-1 rounded w-full mb-2"
                      value={editandoProduto.precoMax}
                      placeholder="Preço Máximo"
                      onChange={e => setEditandoProduto({ ...editandoProduto, precoMax: e.target.value })}
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => salvarEdicao(produto.id)} className="bg-green-600 px-3 py-1 rounded font-bold text-white flex-1">Salvar</button>
                      <button onClick={() => setEditandoId(null)} className="bg-gray-500 px-3 py-1 rounded font-bold text-white flex-1">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-900 p-4 rounded-lg flex flex-col gap-2 shadow-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className="font-bold text-lg text-blue-200">{produto.nome}</span>
                      <div className="flex flex-wrap gap-4 text-gray-400 text-sm">
                        <span>Qtd: <b>{produto.quantidade}</b></span>
                        <span>Min: R$ {produto.precoMin}</span>
                        <span>Max: R$ {produto.precoMax}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => iniciarEdicao(produto)} className="bg-yellow-500 px-3 py-1 rounded font-bold flex-1">Editar</button>
                      <button onClick={() => excluirProduto(produto.id)} className="bg-red-600 px-3 py-1 rounded font-bold flex-1">Excluir</button>
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

export default Estoque;
