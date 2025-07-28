import React, { useState, useEffect } from "react";
import OfflineBanner from "../components/OfflineBanner";
import { collection, addDoc, onSnapshot, query, where, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { saveLocal, loadLocal, addPendingSync, getPendingSync, removePendingSync } from "../utils/sync";
import { registrarLog } from "../utils/log";
import {
  addPendingSale,
  getPendingSales,
  markSaleSynced,
  markSaleDeleted,
  markSaleEdited,
  removeSale,
  syncPendingSales
} from "../utils/offlineSync";
import localforage from "localforage";

const Vender = () => {
  // Excluir venda (robusto online/offline)
  const excluirVenda = async (id) => {
    if (!window.confirm("Deseja mesmo excluir esta venda?")) return;
    setVendasExcluindo((prev) => [...prev, id]);
    setVendasExcluindoPersistidas(loja, [...getVendasExcluindoPersistidas(loja), id]);

    // Verifica se é venda pendente (offline)
    const pendente = pendingSales.find(v => v.id === id);
    if (pendente) {
      await markSaleDeleted(id);
      exibirMensagem("Venda pendente marcada para exclusão. Será removida ao sincronizar.");
      getPendingSales().then(setPendingSales);
      setVendasExcluindo((prev) => prev.filter((vid) => vid !== id));
      return;
    }

    // Venda online
    setVendas((prevVendas) => prevVendas.filter((v) => v.id !== id));
    try {
      if (navigator.onLine) {
        await deleteDoc(doc(db, "vendas", id));
        exibirMensagem("Venda excluída com sucesso.");
      } else {
        // Marca para exclusão futura
        await markSaleDeleted(id);
        exibirMensagem("Venda marcada para exclusão. Será removida ao sincronizar.");
        getPendingSales().then(setPendingSales);
      }
      setVendasExcluindo((prev) => prev.filter((vid) => vid !== id));
      setVendasExcluindoPersistidas(loja, getVendasExcluindoPersistidas(loja).filter((vid) => vid !== id));
      await registrarLog({
        acao: "excluir",
        alvo: "venda",
        usuario: funcionario?.nome || "-",
        loja: loja?.nome || "-",
        detalhes: { vendaId: id }
      });
    } catch (e) {
      exibirMensagem("Erro ao excluir venda. Tente novamente.");
    }
  };
  const { funcionario, loja } = useAuth();
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState([]);

  // Função de ordenação natural
  function naturalSort(a, b) {
    return a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true, sensitivity: 'base' });
  }
  const [vendas, setVendas] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [itensVenda, setItensVenda] = useState([{ produto: "", quantidade: 1 }]);
  const [pagamentos, setPagamentos] = useState([{ forma: "dinheiro", valor: "" }]);
  const [observacao, setObservacao] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [ultimaVendaId, setUltimaVendaId] = useState(null);
  const [editandoVendaId, setEditandoVendaId] = useState(null);
  const [editandoVenda, setEditandoVenda] = useState(null);
  const [vendasExcluindo, setVendasExcluindo] = useState(() => getVendasExcluindoPersistidas(loja));
  const [pendingSales, setPendingSales] = useState([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Utilitário para persistir vendas em exclusão
  function getVendasExcluindoPersistidas(loja) {
    try {
      return JSON.parse(localStorage.getItem(`vendasExcluindo_${loja?.nome}`)) || [];
    } catch {
      return [];
    }
  }
  function setVendasExcluindoPersistidas(loja, arr) {
    localStorage.setItem(`vendasExcluindo_${loja?.nome}`, JSON.stringify(arr));
  }

  useEffect(() => {
    const updateStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  useEffect(() => {
    if (!loja) return;
    // Carregar vendas locais primeiro
    const vendasLocais = loadLocal(`vendas_${loja.nome}`);
    if (vendasLocais.length > 0) setVendas(vendasLocais);
    // Carregar pendentes locais
    setPendentes(getPendingSync(`vendas_${loja.nome}`));
    // Sincronizar pendentes se online
    if (navigator.onLine) {
      (async () => {
        const pendentesSync = getPendingSync(`vendas_${loja.nome}`);
        for (const venda of pendentesSync) {
          try {
            // Verifica se já existe venda com offlineId
            let offlineId = venda.offlineId || venda.id;
            const q = query(collection(db, "vendas"), where("loja", "==", loja.nome), where("offlineId", "==", offlineId));
            const snap = await (await import("firebase/firestore")).getDocs(q);
            let docRef = null;
            if (!snap.empty) {
              // Já existe, pega o id do servidor
              docRef = { id: snap.docs[0].id };
            } else {
              // Não existe, cria nova
              docRef = await addDoc(collection(db, "vendas"), { ...venda, offlineId });
            }
            // Atualiza o ID da venda local e remove o antigo
            const vendasLocais = loadLocal(`vendas_${loja.nome}`);
            const novasVendasLocais = vendasLocais.map(v => v.id === venda.id ? { ...v, id: docRef.id, offlineId } : v);
            saveLocal(`vendas_${loja.nome}`, novasVendasLocais);
            // Remove pendente antigo
            removePendingSync(`vendas_${loja.nome}`, venda.id);
            setPendentes(getPendingSync(`vendas_${loja.nome}`));
          } catch {}
        }
      })();
    }
    const qProdutos = query(collection(db, "produtos"), where("loja", "==", loja.nome));
    const unsubscribeProdutos = onSnapshot(qProdutos, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      lista.sort(naturalSort);
      setProdutos(lista);
    });
    const qVendas = query(collection(db, "vendas"), where("loja", "==", loja.nome));
    const unsubscribeVendas = onSnapshot(qVendas, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // Sincronizar ids locais com ids do Firestore usando offlineId
      let vendasLocais = loadLocal(`vendas_${loja.nome}`) || [];
      let mudou = false;
      // Para cada venda local, se tiver offlineId e encontrar no Firestore, atualiza o id
      vendasLocais = vendasLocais.map(local => {
        if (local.offlineId) {
          const noFirestore = lista.find(v => v.offlineId === local.offlineId);
          if (noFirestore && local.id !== noFirestore.id) {
            mudou = true;
            return { ...local, id: noFirestore.id };
          }
        } else {
          // Para vendas antigas SEM offlineId, tenta casar pelos campos principais
          const noFirestore = lista.find(v =>
            !v.offlineId &&
            v.vendedor === local.vendedor &&
            v.loja === local.loja &&
            Math.abs(new Date(v.data).getTime() - new Date(local.data).getTime()) < 60000 && // datas próximas (1 min)
            JSON.stringify(v.itens) === JSON.stringify(local.itens) &&
            JSON.stringify(v.pagamentos) === JSON.stringify(local.pagamentos) &&
            (v.observacao || "") === (local.observacao || "")
          );
          if (noFirestore && local.id !== noFirestore.id) {
            mudou = true;
            return { ...local, id: noFirestore.id };
          }
        }
        return local;
      });
      if (mudou) {
        // Deduplicar vendas locais por id (mantendo a mais recente)
        const dedup = {};
        for (const v of vendasLocais) {
          if (!dedup[v.id] || new Date(v.data) > new Date(dedup[v.id].data)) {
            dedup[v.id] = v;
          }
        }
        vendasLocais = Object.values(dedup);
        saveLocal(`vendas_${loja.nome}`, vendasLocais);
      }
      const excluindo = getVendasExcluindoPersistidas(loja);
      setVendas(vendasLocais.filter(v => !excluindo.includes(v.id)).sort((a, b) => new Date(b.data) - new Date(a.data)));
      saveLocal(`vendas_${loja.nome}`, lista);
      setPendentes(getPendingSync(`vendas_${loja.nome}`));
    });
    return () => {
      unsubscribeProdutos();
      unsubscribeVendas();
    };
  }, [loja]);

  const calcularValorMinimo = () => {
    return itensVenda.reduce((total, item) => {
      const produto = produtos.find((p) => p.nome === item.produto);
      return produto ? total + (produto.precoMin * item.quantidade) : total;
    }, 0);
  };

  const exibirMensagem = (texto, tempo = 3000) => {
    setMensagem(texto);
    setTimeout(() => setMensagem(""), tempo);
  };

  const limparCampos = () => {
    setItensVenda([{ produto: "", quantidade: 1 }]);
    setPagamentos([{ forma: "dinheiro", valor: "" }]);
    setObservacao("");
  };

  const handleVenda = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      if (!loja || !funcionario) {
        exibirMensagem("Erro: Loja ou usuário não definido.");
        return;
      }
      for (let item of itensVenda) {
        if (!item.produto) {
          exibirMensagem("Selecione um produto.");
          return;
        }
        const produto = produtos.find((p) => p.nome === item.produto);
        if (!produto) {
          exibirMensagem("Produto não encontrado: " + item.produto);
          return;
        }
        if (produto.quantidade < item.quantidade) {
          const confirmar = window.confirm("Estoque ficará negativo para o produto: " + item.produto + ". Tem certeza de realizar a venda?");
          if (!confirmar) return;
        }
      }
      const vendaData = {
        itens: itensVenda,
        pagamentos,
        observacao,
        vendedor: funcionario.nome,
        data: new Date().toISOString(),
        loja: loja.nome
      };
      const offlineId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      let vendaId = null;
      if (!isOffline) {
        // Deduplicação online
        const vendasRef = collection(db, "vendas");
        const q = query(vendasRef, where("offlineId", "==", offlineId));
        const snapshot = await (await import("firebase/firestore")).getDocs(q);
        if (!snapshot.empty) {
          exibirMensagem("Venda já registrada. Não será duplicada.");
          return;
        }
        const docRef = await addDoc(vendasRef, { ...vendaData, offlineId });
        vendaId = docRef.id;
        // Atualiza estado local imediatamente
        setVendas(prev => [{ ...vendaData, id: docRef.id, offlineId }, ...prev].slice(0, 10));
        for (let item of itensVenda) {
          const produto = produtos.find((p) => p.nome === item.produto);
          if (produto) {
            await updateDoc(doc(db, "produtos", produto.id), {
              quantidade: produto.quantidade - item.quantidade
            });
          }
        }
        await registrarLog({
          acao: "adicionar",
          alvo: "venda",
          usuario: funcionario.nome,
          loja: loja.nome,
          detalhes: { itens: itensVenda, pagamentos, observacao },
        });
        setUltimaVendaId(vendaId);
        exibirMensagem("Venda registrada com sucesso");
        limparCampos();
        setTimeout(() => setUltimaVendaId(null), 2000);
      } else {
        vendaId = offlineId;
        const vendaOffline = { ...vendaData, id: vendaId, offlineId };
        await addPendingSale(vendaOffline);
        setTimeout(() => setSalvando(false), 1500); // desabilita botão por 1.5s
        exibirMensagem("Pending sale registered");
        limparCampos();
        getPendingSales().then(setPendingSales);
      }
    } catch (e) {
      exibirMensagem("Erro ao salvar venda. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  // Adiciona um novo item de venda
  const adicionarItem = () => {
    setItensVenda([...itensVenda, { produto: "", quantidade: 1 }]);
  };

  // Remove um item de venda pelo índice
  const removerItem = (idx) => {
    setItensVenda(itensVenda.filter((_, i) => i !== idx));
  };

  // Adiciona um novo pagamento
  const adicionarPagamento = () => {
    setPagamentos([...pagamentos, { forma: "dinheiro", valor: "" }]);
  };

  // Remove um pagamento pelo índice
  const removerPagamento = (idx) => {
    setPagamentos(pagamentos.filter((_, i) => i !== idx));
  };

  // Atualiza campos de itens
  const handleItemChange = (idx, campo, valor) => {
    const novos = [...itensVenda];
    novos[idx][campo] = campo === "quantidade" ? Number(valor) : valor;
    setItensVenda(novos);
  };

  // Atualiza campos de pagamentos
  const handlePagamentoChange = (idx, campo, valor) => {
    const novos = [...pagamentos];
    novos[idx][campo] = valor;
    setPagamentos(novos);
  };

  useEffect(() => {
    window.addEventListener("online", () => {
      if (loja) {
        const pendentes = getPendingSync(`vendas_${loja.nome}`);
        pendentes.forEach(async (venda) => {
          try {
            await addDoc(collection(db, "vendas"), venda);
            removePendingSync(`vendas_${loja.nome}`, venda.id);
          } catch {}
        });
      }
    });
  }, [loja]);

  // Função para salvar edição de venda (offline/online)
  const salvarEdicaoVenda = async () => {
    if (!editandoVenda) return;
    const id = editandoVenda.id;
    if (pendingSales.find(v => v.id === id)) {
      await markSaleEdited(id, editandoVenda);
      exibirMensagem("Alteração pendente salva. Será sincronizada quando online.");
      getPendingSales().then(setPendingSales);
      setEditandoVendaId(null);
      setEditandoVenda(null);
      return;
    }
    try {
      if (navigator.onLine) {
        await updateDoc(doc(db, "vendas", id), editandoVenda);
        // Atualiza estado local imediatamente
        setVendas(prev => prev.map(v => v.id === id ? { ...v, ...editandoVenda } : v));
        exibirMensagem("Venda editada com sucesso.");
      } else {
        await markSaleEdited(id, editandoVenda);
        exibirMensagem("Alteração marcada. Será sincronizada quando online.");
        getPendingSales().then(setPendingSales);
      }
      setEditandoVendaId(null);
      setEditandoVenda(null);
    } catch (e) {
      exibirMensagem("Erro ao editar venda. Tente novamente.");
    }
  };

  // Corrigir exibição do formulário de edição inline
  const iniciarEdicaoVenda = (venda) => {
    setEditandoVendaId(venda.id);
    setEditandoVenda({ ...venda });
  };


  // Adiciona Pix, Crédito e Débito como formas de pagamento
  const formasPagamento = [
    { value: "dinheiro", label: "Dinheiro" },
    { value: "pix", label: "Pix" },
    { value: "credito", label: "Crédito" },
    { value: "debito", label: "Débito" },
  ];

  return (
    <>
      <OfflineBanner />
      <div className="flex flex-col min-h-screen bg-gray-900 text-white">
        <div className="flex-1 w-full max-w-3xl mx-auto p-2 sm:p-4 md:p-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-blue-300 mb-6 text-center sm:text-left">Nova Venda</h1>
          <div className="bg-gray-800 p-2 sm:p-6 rounded-lg shadow-lg">
            <form onSubmit={e => e.preventDefault()} autoComplete="off">
              {/* Campos para itens da venda */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {itensVenda.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center w-full">
                    <select
                      className="p-2 rounded text-black w-32 sm:w-40 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={item.produto}
                      onChange={e => handleItemChange(idx, "produto", e.target.value)}
                    >
                      <option value="">Produto</option>
                      {produtos.map(p => (
                        <option key={p.id} value={p.nome}>{p.nome}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="p-2 rounded text-black w-16 sm:w-24 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={item.quantidade === 0 ? '' : item.quantidade}
                      placeholder="Qtd"
                      onChange={e => handleItemChange(idx, "quantidade", e.target.value === '' ? '' : e.target.value)}
                      min={1}
                    />
                    <button type="button" aria-label="Remover item" onClick={() => removerItem(idx)} className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-white font-bold text-lg">-</button>
                  </div>
                ))}
                <button type="button" aria-label="Adicionar item" onClick={adicionarItem} className="bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-white font-bold w-full md:w-auto">Adicionar Item</button>
              </div>
              {/* Pagamentos */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {pagamentos.map((pag, idx) => (
                  <div key={idx} className="flex gap-2 items-center w-full">
                    <select
                      className="p-2 rounded text-black w-32 sm:w-40 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={pag.forma}
                      onChange={e => handlePagamentoChange(idx, "forma", e.target.value)}
                    >
                      {formasPagamento.map(fp => (
                        <option key={fp.value} value={fp.value}>{fp.label}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="p-2 rounded text-black w-16 sm:w-24 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={pag.valor === 0 ? '' : pag.valor}
                      placeholder="Valor"
                      onChange={e => handlePagamentoChange(idx, "valor", e.target.value === '' ? '' : e.target.value)}
                      min={0}
                    />
                    <button type="button" aria-label="Remover pagamento" onClick={() => removerPagamento(idx)} className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-white font-bold text-lg">-</button>
                  </div>
                ))}
                <button type="button" aria-label="Adicionar pagamento" onClick={adicionarPagamento} className="bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-white font-bold w-full md:w-auto">Adicionar Pagamento</button>
              </div>
              <textarea
                className="w-full p-3 rounded text-black mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Observação"
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                rows={2}
              />
              <button type="button" onClick={handleVenda} className="bg-blue-600 hover:bg-blue-700 w-full py-3 rounded font-bold text-lg text-white mt-2" disabled={salvando}>Salvar Venda</button>
              {mensagem && <div className={`mt-4 text-center font-bold animate-pulse ${mensagem.includes('pendente') ? 'text-yellow-300' : 'text-green-400'}`}>{mensagem}</div>}
            </form>
          </div>
          {/* Histórico das últimas 10 vendas (sincronizadas e pendentes) */}
          <div className="mt-8 bg-gray-900 p-2 sm:p-4 rounded-lg shadow-lg">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-blue-200">Últimas 10 vendas</h2>
            <ul className="divide-y divide-gray-700">
              {[
                ...pendingSales.map(v => ({ ...v, _pendente: true })),
                ...vendas.filter(v => !pendingSales.some(p => p.id === v.id)).map(v => ({ ...v, _pendente: false }))
              ]
                .sort((a, b) => new Date(b.data) - new Date(a.data))
                .slice(0, 10)
                .map((venda) => (
                  <li key={venda.id} className="py-3">
                    {editandoVendaId === venda.id ? (
                      <div className="bg-gray-900 p-4 rounded-lg flex flex-col gap-2 shadow-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <span className="font-bold text-lg text-blue-200">{editandoVenda?.vendedor}</span>
                          <div className="flex flex-wrap gap-4 text-gray-400 text-sm">
                            <span>{new Date(editandoVenda?.data).toLocaleString()}</span>
                          </div>
                        </div>
                        {/* Editar Itens */}
                        <div className="mb-2">
                          <div className="font-bold text-blue-200 mb-1">Itens</div>
                          {editandoVenda?.itens?.map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-center mb-1">
                              <select
                                className="p-2 rounded text-black w-32 sm:w-40"
                                value={item.produto}
                                onChange={e => {
                                  const novos = [...editandoVenda.itens];
                                  novos[idx].produto = e.target.value;
                                  setEditandoVenda({ ...editandoVenda, itens: novos });
                                }}
                              >
                                <option value="">Produto</option>
                                {produtos.map(p => (
                                  <option key={p.id} value={p.nome}>{p.nome}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                className="p-2 rounded text-black w-16 sm:w-24"
                                value={item.quantidade === 0 ? '' : item.quantidade}
                                min={1}
                                onChange={e => {
                                  const novos = [...editandoVenda.itens];
                                  novos[idx].quantidade = Number(e.target.value);
                                  setEditandoVenda({ ...editandoVenda, itens: novos });
                                }}
                              />
                              <button type="button" onClick={() => {
                                const novos = editandoVenda.itens.filter((_, i) => i !== idx);
                                setEditandoVenda({ ...editandoVenda, itens: novos });
                              }} className="bg-red-600 px-2 py-1 rounded text-white font-bold">-</button>
                            </div>
                          ))}
                          <button type="button" onClick={() => setEditandoVenda({ ...editandoVenda, itens: [...editandoVenda.itens, { produto: '', quantidade: 1 }] })} className="bg-green-600 px-2 py-1 rounded text-white font-bold mt-1">Adicionar Item</button>
                        </div>
                        {/* Editar Pagamentos */}
                        <div className="mb-2">
                          <div className="font-bold text-blue-200 mb-1">Pagamentos</div>
                          {editandoVenda?.pagamentos?.map((pag, idx) => (
                            <div key={idx} className="flex gap-2 items-center mb-1">
                              <select
                                className="p-2 rounded text-black w-32 sm:w-40"
                                value={pag.forma}
                                onChange={e => {
                                  const novos = [...editandoVenda.pagamentos];
                                  novos[idx].forma = e.target.value;
                                  setEditandoVenda({ ...editandoVenda, pagamentos: novos });
                                }}
                              >
                                {formasPagamento.map(fp => (
                                  <option key={fp.value} value={fp.value}>{fp.label}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                className="p-2 rounded text-black w-16 sm:w-24"
                                value={pag.valor === 0 ? '' : pag.valor}
                                min={0}
                                onChange={e => {
                                  const novos = [...editandoVenda.pagamentos];
                                  novos[idx].valor = e.target.value;
                                  setEditandoVenda({ ...editandoVenda, pagamentos: novos });
                                }}
                              />
                              <button type="button" onClick={() => {
                                const novos = editandoVenda.pagamentos.filter((_, i) => i !== idx);
                                setEditandoVenda({ ...editandoVenda, pagamentos: novos });
                              }} className="bg-red-600 px-2 py-1 rounded text-white font-bold">-</button>
                            </div>
                          ))}
                          <button type="button" onClick={() => setEditandoVenda({ ...editandoVenda, pagamentos: [...editandoVenda.pagamentos, { forma: 'dinheiro', valor: '' }] })} className="bg-green-600 px-2 py-1 rounded text-white font-bold mt-1">Adicionar Pagamento</button>
                        </div>
                        {/* Editar Observação */}
                        <div className="mb-2">
                          <div className="font-bold text-blue-200 mb-1">Observação</div>
                          <textarea
                            className="w-full p-2 rounded text-black"
                            value={editandoVenda?.observacao || ''}
                            onChange={e => setEditandoVenda({ ...editandoVenda, observacao: e.target.value })}
                            rows={2}
                          />
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => setEditandoVendaId(null)} className="bg-gray-600 px-3 py-1 rounded font-bold flex-1">Cancelar</button>
                          <button onClick={salvarEdicaoVenda} className="bg-green-600 px-3 py-1 rounded font-bold flex-1">Salvar</button>
                        </div>
                      </div>
                    ) : (
                      <div className={`bg-gray-900 p-4 rounded-lg flex flex-col gap-2 shadow-lg${venda._pendente ? ' border-2 border-yellow-400' : ''}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <span className="font-bold text-lg text-blue-200">{venda.vendedor}</span>
                          <div className="flex flex-wrap gap-4 text-gray-400 text-sm">
                            <span>{new Date(venda.data).toLocaleString()}</span>
                            <span>Itens: {venda.itens.map(i => `${i.produto} (${i.quantidade})`).join(", ")}</span>
                            <span>Pagamentos: {venda.pagamentos.map(p => `${p.forma}: R$${p.valor}`).join(", ")}</span>
                            {venda.observacao && <span className="text-yellow-300">Obs: {venda.observacao}</span>}
                          </div>
                        </div>
                        {venda._pendente && (
                          <div className="flex gap-2 mt-2 items-center">
                            <span className="text-yellow-400 font-bold animate-pulse">VENDA PENDENTE <span title="Offline"><svg width="16" height="16" fill="currentColor" className="inline ml-1"><circle cx="8" cy="8" r="7" stroke="orange" strokeWidth="2" fill="none"/><line x1="4" y1="8" x2="12" y2="8" stroke="orange" strokeWidth="2"/></svg></span></span>
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => iniciarEdicaoVenda(venda)} className="bg-yellow-500 px-3 py-1 rounded font-bold flex-1">Editar</button>
                          <button onClick={() => excluirVenda(venda.id)} className="bg-red-600 px-3 py-1 rounded font-bold flex-1">Excluir</button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
            </ul>
            <button
              className="mt-6 w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 rounded-lg text-lg shadow-lg"
              onClick={() => navigate('/vendas')}
            >
              Ver todas as vendas
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
export default Vender;
