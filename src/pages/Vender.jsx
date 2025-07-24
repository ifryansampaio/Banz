import React, { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, query, where, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { saveLocal, loadLocal, addPendingSync, getPendingSync, removePendingSync } from "../utils/sync";
import { registrarLog } from "../utils/log";

const Vender = () => {
  const { funcionario, loja } = useAuth();
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [itensVenda, setItensVenda] = useState([{ produto: "", quantidade: 1 }]);
  const [pagamentos, setPagamentos] = useState([{ forma: "dinheiro", valor: "" }]);
  const [observacao, setObservacao] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ultimaVendaId, setUltimaVendaId] = useState(null);
  const [editandoVendaId, setEditandoVendaId] = useState(null);
  const [editandoVenda, setEditandoVenda] = useState(null);
  const [vendasExcluindo, setVendasExcluindo] = useState(() => getVendasExcluindoPersistidas(loja));

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
    if (!loja) return;
    // Carregar vendas locais primeiro
    const vendasLocais = loadLocal(`vendas_${loja.nome}`);
    if (vendasLocais.length > 0) setVendas(vendasLocais);
    // Sincronizar pendentes se online
    if (navigator.onLine) {
      const pendentes = getPendingSync(`vendas_${loja.nome}`);
      pendentes.forEach(async (venda) => {
        try {
          await addDoc(collection(db, "vendas"), venda);
          removePendingSync(`vendas_${loja.nome}`, venda.id);
        } catch {}
      });
    }
    const qProdutos = query(collection(db, "produtos"), where("loja", "==", loja.nome));
    const unsubscribeProdutos = onSnapshot(qProdutos, (snapshot) => {
      setProdutos(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    const qVendas = query(collection(db, "vendas"), where("loja", "==", loja.nome));
    const unsubscribeVendas = onSnapshot(qVendas, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const excluindo = getVendasExcluindoPersistidas(loja);
      setVendas(lista.filter(v => !excluindo.includes(v.id)).sort((a, b) => new Date(b.data) - new Date(a.data)));
      saveLocal(`vendas_${loja.nome}`, lista);
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
        break; // Só precisa perguntar uma vez
      }
    }

    for (let pag of pagamentos) {
      if (!pag.valor || parseFloat(pag.valor) <= 0) {
        exibirMensagem("Preencha corretamente os valores de pagamento.");
        return;
      }
    }

    const valorTotal = pagamentos.reduce((sum, p) => sum + parseFloat(p.valor || 0), 0);
    const valorMinimo = calcularValorMinimo();

    if (valorTotal < valorMinimo) {
      const confirmar = window.confirm(`Valor abaixo da faixa de preço recomendada (mínimo R$ ${valorMinimo.toFixed(2)}). Deseja continuar?`);
      if (!confirmar) return;
    }

    try {
      // Cria objeto sem o campo id local para salvar no Firestore
      const vendaData = {
        loja: loja.nome,
        itens: itensVenda,
        pagamentos,
        observacao,
        vendedor: funcionario.nome,
        data: new Date().toISOString(),
        alerta: valorTotal < valorMinimo
      };
      if (navigator.onLine) {
        const docRef = await addDoc(collection(db, "vendas"), vendaData);
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
          detalhes: { itens: itensVenda, pagamentos, observacao }
        });
        // Não atualiza manualmente o estado ou localStorage aqui, pois o onSnapshot já faz isso
        setUltimaVendaId(docRef.id);
      } else {
        // Salva local e marca como pendente
        const vendaOffline = { ...vendaData, id: Date.now().toString() };
        addPendingSync(`vendas_${loja.nome}`, vendaOffline);
        const vendasLocais = loadLocal(`vendas_${loja.nome}`);
        saveLocal(`vendas_${loja.nome}`, [vendaOffline, ...vendasLocais]);
        await registrarLog({
          acao: "adicionar (offline)",
          alvo: "venda",
          usuario: funcionario.nome,
          loja: loja.nome,
          detalhes: { itens: itensVenda, pagamentos, observacao }
        });
        setUltimaVendaId(vendaOffline.id);
      }
      exibirMensagem("Venda registrada com sucesso");
      limparCampos();
      setTimeout(() => setUltimaVendaId(null), 2000);
    } catch (e) {
      console.error("Erro ao registrar venda:", e);
      exibirMensagem("Erro ao registrar venda: " + (e && e.message ? e.message : e));
    }
  };

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

  // Editar venda inline
  const iniciarEdicaoVenda = (venda) => {
    setEditandoVendaId(venda.id);
    setEditandoVenda({ ...venda });
  };
  const cancelarEdicaoVenda = () => {
    setEditandoVendaId(null);
    setEditandoVenda(null);
  };
  const salvarEdicaoVenda = async () => {
    if (!editandoVendaId) return;
    try {
      // Busca venda original para restaurar estoque
      const vendaOriginal = vendas.find(v => v.id === editandoVendaId);
      if (vendaOriginal) {
        for (let item of vendaOriginal.itens) {
          const produtosSnap = await (await import("firebase/firestore")).getDocs(
            query(collection(db, "produtos"), where("loja", "==", loja.nome), where("nome", "==", item.produto))
          );
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
        const produtosSnap = await (await import("firebase/firestore")).getDocs(
          query(collection(db, "produtos"), where("loja", "==", loja.nome), where("nome", "==", item.produto))
        );
        produtosSnap.forEach(async (docu) => {
          const produto = docu.data();
          await updateDoc(doc(db, "produtos", docu.id), {
            quantidade: produto.quantidade - item.quantidade
          });
        });
      }
      // Atualiza alerta corretamente
      let valorMinimo = 0;
      for (let item of editandoVenda.itens) {
        const produto = produtos.find((p) => p.nome === item.produto);
        if (produto) valorMinimo += (produto.precoMin || 0) * item.quantidade;
      }
      const valorTotal = editandoVenda.pagamentos.reduce((sum, p) => sum + parseFloat(p.valor || 0), 0);
      const novoAlerta = valorTotal < valorMinimo;
      const vendaAtualizada = { ...editandoVenda, alerta: novoAlerta };
      await updateDoc(doc(db, "vendas", editandoVendaId), vendaAtualizada);
      setEditandoVendaId(null);
      setEditandoVenda(null);
      exibirMensagem("Venda editada com sucesso!");
    } catch (e) {
      exibirMensagem("Erro ao salvar edição da venda: " + (e && e.message ? e.message : e));
    }
  };

  const excluirVenda = async (id) => {
    if (!window.confirm("Deseja mesmo excluir esta venda?")) return;
    const excluindoAtual = getVendasExcluindoPersistidas(loja);
    if (excluindoAtual.includes(id)) return;
    setVendasExcluindo((prev) => [...prev, id]);
    setVendasExcluindoPersistidas(loja, [...excluindoAtual, id]);
    setVendas((prev) => prev.filter((v) => v.id !== id));
    try {
      // Restaurar estoque dos itens da venda
      const venda = vendas.find(v => v.id === id);
      if (venda) {
        for (let item of venda.itens) {
          const produtosSnap = await (await import("firebase/firestore")).getDocs(
            query(collection(db, "produtos"), where("loja", "==", loja.nome), where("nome", "==", item.produto))
          );
          produtosSnap.forEach(async (docu) => {
            const produto = docu.data();
            await updateDoc(doc(db, "produtos", docu.id), {
              quantidade: produto.quantidade + item.quantidade
            });
          });
        }
      }
      await deleteDoc(doc(db, "vendas", id));
      await registrarLog({
        acao: "excluir",
        alvo: "venda",
        usuario: funcionario ? funcionario.nome : "admin",
        loja: loja ? loja.nome : "-",
        detalhes: { vendaId: id }
      });
      if (editandoVendaId === id) cancelarEdicaoVenda();
      exibirMensagem("Venda excluída e estoque restaurado.");
    } catch (e) {
      console.error("Erro ao excluir venda Firestore:", e);
      exibirMensagem("Erro ao excluir venda: " + (e && e.message ? e.message : e));
    } finally {
      setVendasExcluindo((prev) => prev.filter((vid) => vid !== id));
      const atual = getVendasExcluindoPersistidas(loja).filter((vid) => vid !== id);
      setVendasExcluindoPersistidas(loja, atual);
    }
  };

  // Adiciona Pix, Crédito e Débito como formas de pagamento
  const formasPagamento = [
    { value: "dinheiro", label: "Dinheiro" },
    { value: "pix", label: "Pix" },
    { value: "credito", label: "Crédito" },
    { value: "debito", label: "Débito" },
  ];

  return (
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
            <button type="button" onClick={handleVenda} className="bg-blue-600 hover:bg-blue-700 w-full py-3 rounded font-bold text-lg text-white mt-2">Salvar Venda</button>
            {mensagem && <div className="mt-4 text-green-400 text-center font-bold animate-pulse">{mensagem}</div>}
          </form>
        </div>
        {/* Histórico das últimas 10 vendas com edição inline */}
        <div className="mt-8 bg-gray-900 p-2 sm:p-4 rounded-lg shadow-lg">
          <h2 className="text-lg sm:text-xl font-bold mb-4 text-blue-200">Últimas 10 vendas</h2>
          <ul className="divide-y divide-gray-700">
            {vendas.slice(0, 10).map((venda) => (
              <li key={venda.id} className="py-3">
                {editandoVendaId === venda.id ? (
                  <div className="bg-gray-900 p-4 rounded-lg flex flex-col gap-2 shadow-lg">
                    <div className="flex flex-col gap-2 mt-2">
                      <span className="text-blue-200 font-bold">Itens:</span>
                      {editandoVenda.itens.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <select
                            className="p-1 rounded text-black w-32"
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
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="p-1 rounded text-black w-20"
                            value={item.quantidade === 0 ? '' : item.quantidade}
                            placeholder="Qtd"
                            onChange={e => {
                              const novos = [...editandoVenda.itens];
                              novos[idx].quantidade = e.target.value === '' ? '' : Number(e.target.value);
                              setEditandoVenda({ ...editandoVenda, itens: novos });
                            }}
                            min={1}
                          />
                          <button type="button" onClick={() => {
                            const novos = editandoVenda.itens.filter((_, i) => i !== idx);
                            setEditandoVenda({ ...editandoVenda, itens: novos });
                          }} className="bg-red-600 px-2 py-1 rounded text-white font-bold">-</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setEditandoVenda({ ...editandoVenda, itens: [...editandoVenda.itens, { produto: '', quantidade: 1 }] })} className="bg-green-600 px-2 py-1 rounded text-white font-bold w-full md:w-auto">Adicionar Item</button>
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
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="p-1 rounded text-black w-20"
                            value={pag.valor === 0 ? '' : pag.valor}
                            placeholder="Valor"
                            onChange={e => {
                              const novos = [...editandoVenda.pagamentos];
                              novos[idx].valor = e.target.value === '' ? '' : e.target.value;
                              setEditandoVenda({ ...editandoVenda, pagamentos: novos });
                            }}
                            min={0}
                          />
                          <button type="button" onClick={() => {
                            const novos = editandoVenda.pagamentos.filter((_, i) => i !== idx);
                            setEditandoVenda({ ...editandoVenda, pagamentos: novos });
                          }} className="bg-red-600 px-2 py-1 rounded text-white font-bold">-</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setEditandoVenda({ ...editandoVenda, pagamentos: [...editandoVenda.pagamentos, { forma: 'dinheiro', valor: '' }] })} className="bg-green-600 px-2 py-1 rounded text-white font-bold w-full md:w-auto">Adicionar Pagamento</button>
                    </div>
                    <input
                      type="text"
                      className="text-black p-1 rounded w-48"
                      placeholder="Observação"
                      value={editandoVenda.observacao}
                      onChange={e => setEditandoVenda({ ...editandoVenda, observacao: e.target.value })}
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={salvarEdicaoVenda} className="bg-green-600 px-3 py-1 rounded font-bold text-white flex-1">Salvar</button>
                      <button onClick={cancelarEdicaoVenda} className="bg-gray-500 px-3 py-1 rounded font-bold text-white flex-1">Cancelar</button>
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
  );
};

export default Vender;
