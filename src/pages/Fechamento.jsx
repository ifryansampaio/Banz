import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, where, addDoc, deleteDoc, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { exportarBackupFirestore } from "../utils/backup";

const Fechamento = () => {
  const { loja } = useAuth();
  const [vendas, setVendas] = useState([]);
  const [totais, setTotais] = useState({ total: 0, dinheiro: 0, maquininha: 0, alertas: 0, itens: {} });
  const [fechando, setFechando] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [selectedFechamento, setSelectedFechamento] = useState(null);
  const [editVenda, setEditVenda] = useState(null);
  const [editVendaData, setEditVendaData] = useState(null);
  const [funcionarios, setFuncionarios] = useState([]);

  useEffect(() => {
    if (!loja) return;
    const q = query(collection(db, "vendas"), where("loja", "==", loja.nome));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const ordenadas = lista.sort((a, b) => new Date(b.data) - new Date(a.data));
      calcularTotais(ordenadas);
      setVendas(ordenadas);
    });
    return () => unsubscribe();
  }, [loja]);

  useEffect(() => {
    if (!loja) return;
    const q = query(collection(db, "fechamentos"), where("loja", "==", loja.nome));
    getDocs(q).then(snapshot => {
      setHistorico(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [loja, fechando, editVenda]);

  useEffect(() => {
    if (!loja) return;
    // Verifica se existe fechamento do dia anterior e faz automático se necessário
    const checkAndAutoClose = async () => {
      const hoje = new Date();
      const hojeStr = hoje.toISOString().slice(0, 10);
      const q = query(collection(db, "fechamentos"), where("loja", "==", loja.nome));
      const fechamentosSnap = await getDocs(q);
      const datasFechadas = fechamentosSnap.docs.map(doc => doc.data().data);
      // Busca vendas não fechadas
      const vendasSnap = await getDocs(query(collection(db, "vendas"), where("loja", "==", loja.nome)));
      const vendasPendentes = vendasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (vendasPendentes.length > 0) {
        // Descobre a data da venda mais antiga
        const dataMaisAntiga = vendasPendentes.reduce((min, v) => v.data < min ? v.data : min, vendasPendentes[0].data);
        const dataVenda = dataMaisAntiga.slice(0, 10);
        if (dataVenda < hojeStr && !datasFechadas.includes(dataVenda)) {
          // Faz fechamento automático do dia anterior
          const vendasDoDia = vendasPendentes.filter(v => v.data.slice(0, 10) === dataVenda);
          const totais = calcularTotais(vendasDoDia, true);
          await addDoc(collection(db, "fechamentos"), {
            loja: loja.nome,
            data: dataVenda,
            vendas: vendasDoDia,
            totais,
          });
          // Remove vendas fechadas
          for (const v of vendasDoDia) {
            await deleteDoc(doc(db, "vendas", v.id));
          }
        }
      }
    };
    checkAndAutoClose();
  }, [loja]);

  useEffect(() => {
    async function fetchFuncionarios() {
      const snap = await getDocs(collection(db, "funcionarios"));
      setFuncionarios(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
    fetchFuncionarios();
  }, []);

  const calcularTotais = (vendasLista, isFechamento = false) => {
    let total = 0;
    let dinheiro = 0;
    let maquininha = 0;
    let alertas = 0;
    let itens = {};
    vendasLista.forEach((v) => {
      const somaPag = v.pagamentos.reduce((sum, p) => sum + parseFloat(p.valor || 0), 0);
      total += somaPag;
      v.pagamentos.forEach((p) => {
        if (p.forma === "dinheiro") dinheiro += parseFloat(p.valor || 0);
        else maquininha += parseFloat(p.valor || 0);
      });
      if (v.alerta) alertas++;
      v.itens.forEach((i) => {
        itens[i.produto] = (itens[i.produto] || 0) + i.quantidade;
      });
    });
    if (isFechamento) {
      setTotais((prev) => ({
        ...prev,
        total: prev.total + total,
        dinheiro: prev.dinheiro + dinheiro,
        maquininha: prev.maquininha + maquininha,
        alertas: prev.alertas + alertas,
        itens: Object.keys(itens).reduce((acc, key) => {
          acc[key] = (prev.itens[key] || 0) + itens[key];
          return acc;
        }, {}),
      }));
    } else {
      setTotais({ total, dinheiro, maquininha, alertas, itens });
    }
  };

  const fecharDia = async () => {
    setFechando(true);
    const hoje = new Date();
    await addDoc(collection(db, "fechamentos"), {
      loja: loja.nome,
      data: hoje.toISOString().slice(0, 10),
      vendas,
      totais,
    });
    // Limpa vendas do dia (pode ser melhorado para só as do dia)
    const vendasSnap = await getDocs(query(collection(db, "vendas"), where("loja", "==", loja.nome)));
    for (const venda of vendasSnap.docs) {
      await deleteDoc(doc(db, "vendas", venda.id));
    }
    // Backup automático da loja após fechamento
    await exportarBackupFirestore();
    setFechando(false);
  };

  const handleSelectFechamento = (fechamento) => {
    setSelectedFechamento(fechamento);
    setEditVenda(null);
  };

  const handleDeleteVenda = async (vendaId) => {
    if (!selectedFechamento) return;
    // Restaurar estoque dos itens da venda
    const venda = selectedFechamento.vendas.find(v => v.id === vendaId);
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
    const vendasAtualizadas = selectedFechamento.vendas.filter(v => v.id !== vendaId);
    const totaisAtualizados = calcularTotais(vendasAtualizadas);
    await updateDoc(doc(db, "fechamentos", selectedFechamento.id), {
      vendas: vendasAtualizadas,
      totais: totaisAtualizados,
    });
    setSelectedFechamento({ ...selectedFechamento, vendas: vendasAtualizadas, totais: totaisAtualizados });
  };

  const handleEditVenda = (venda) => {
    setEditVenda(venda.id);
    setEditVendaData({ ...venda });
  };

  const handleSaveEditVenda = async () => {
    if (!selectedFechamento) return;
    // Restaurar estoque dos itens antigos
    const vendaOriginal = selectedFechamento.vendas.find(v => v.id === editVenda);
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
    // Debitar estoque dos novos itens
    for (let item of editVendaData.itens) {
      const produtosSnap = await getDocs(query(collection(db, "produtos"), where("loja", "==", loja.nome), where("nome", "==", item.produto)));
      produtosSnap.forEach(async (docu) => {
        const produto = docu.data();
        await updateDoc(doc(db, "produtos", docu.id), {
          quantidade: produto.quantidade - item.quantidade
        });
      });
    }
    // Atualiza alerta corretamente
    let valorMinimo = 0;
    for (let item of editVendaData.itens) {
      const produto = (await getDocs(query(collection(db, "produtos"), where("loja", "==", loja.nome), where("nome", "==", item.produto)))).docs[0]?.data();
      if (produto) valorMinimo += (produto.precoMin || 0) * item.quantidade;
    }
    const valorTotal = editVendaData.pagamentos.reduce((sum, p) => sum + parseFloat(p.valor || 0), 0);
    const novoAlerta = valorTotal < valorMinimo;
    const vendaAtualizada = { ...editVendaData, alerta: novoAlerta };
    const vendasAtualizadas = selectedFechamento.vendas.map(v => v.id === editVenda ? vendaAtualizada : v);
    const totaisAtualizados = calcularTotais(vendasAtualizadas);
    await updateDoc(doc(db, "fechamentos", selectedFechamento.id), {
      vendas: vendasAtualizadas,
      totais: totaisAtualizados,
    });
    setSelectedFechamento({ ...selectedFechamento, vendas: vendasAtualizadas, totais: totaisAtualizados });
    setEditVenda(null);
    setEditVendaData(null);
  };

  const handleDeleteFechamento = async (id) => {
    const fechamento = historico.find(f => f.id === id);
    const data = fechamento ? fechamento.data : "";
    if (window.confirm(`Deseja mesmo excluir o fechamento do dia ${data}?`)) {
      await deleteDoc(doc(db, "fechamentos", id));
      setSelectedFechamento(null);
    }
  };

  const [novaVenda, setNovaVenda] = useState({ vendedor: "", data: "", itens: [], pagamentos: [], observacao: "" });
  const handleAddVendaToFechamento = async () => {
    if (!selectedFechamento) return;
    const vendasAtualizadas = [...selectedFechamento.vendas, novaVenda];
    const totaisAtualizados = calcularTotais(vendasAtualizadas, true);
    await updateDoc(doc(db, "fechamentos", selectedFechamento.id), {
      vendas: vendasAtualizadas,
      totais: totaisAtualizados,
    });
    setSelectedFechamento({ ...selectedFechamento, vendas: vendasAtualizadas, totais: totaisAtualizados });
    setNovaVenda({ vendedor: "", data: "", itens: [], pagamentos: [], observacao: "" });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <div className="flex-1 w-full max-w-4xl mx-auto p-2 sm:p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6 text-blue-300 text-center sm:text-left">Fechamento</h1>
        <div className="bg-gray-800 p-2 sm:p-6 rounded-lg shadow-lg overflow-x-auto">
          <p><strong>Total de Vendas:</strong> <span className="text-blue-300">R$ {totais.total.toFixed(2)}</span></p>
          <p><strong>Dinheiro:</strong> <span className="text-green-400">R$ {totais.dinheiro.toFixed(2)}</span></p>
          <p><strong>Maquininha:</strong> <span className="text-purple-400">R$ {totais.maquininha.toFixed(2)}</span></p>
          <p><strong>Vendas com Alerta:</strong> <span className="text-yellow-400">{totais.alertas}</span></p>
          {/* Lista de vendas com alerta */}
          {vendas.filter(v => v.alerta).length > 0 && (
            <div className="mt-4">
              <strong className="text-yellow-400 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-2.97l-7.07-12.25a2 2 0 00-3.48 0L3.19 16.03A2 2 0 004.93 19z" /></svg>
                Vendas com Alerta
              </strong>
              <ul className="ml-4 mt-2">
                {vendas.filter(v => v.alerta).map(v => (
                  <li key={v.id} className="mb-2 flex flex-col md:flex-row md:items-center gap-2 bg-gray-900 p-2 rounded">
                    <span className="font-bold text-blue-300">{v.vendedor.charAt(0).toUpperCase() + v.vendedor.slice(1).toLowerCase()}</span>
                    <span className="text-gray-400">{new Date(v.data).toLocaleString()}</span>
                    <span>Itens: {v.itens.map(i => `${i.produto} (${i.quantidade})`).join(", ")}</span>
                    <span>Pagamentos: {v.pagamentos.map(p => `${p.forma}: R$${p.valor}`).join(", ")}</span>
                    {v.observacao && <span className="text-yellow-300">Obs: {v.observacao}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <strong>Itens Vendidos:</strong>
            <ul className="ml-4">
              {Object.entries(totais.itens)
                .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
                .map(([nome, qtd]) => (
                  <li key={nome}>{nome}: <span className="text-blue-200 font-bold">{qtd}</span></li>
                ))}
            </ul>
          </div>
          <button onClick={fecharDia} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded mt-4 font-bold text-white" disabled={fechando}>
            {fechando ? "Fechando..." : "Fechar o Dia"}
          </button>
        </div>
        <h2 className="text-xl mb-2 mt-6 text-blue-200 font-semibold">Histórico de Fechamentos</h2>
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg mb-4">
          {historico.length === 0 ? (
            <div className="text-gray-300">Nenhum fechamento registrado.</div>
          ) : (
            <ul className="divide-y divide-gray-700">
              {historico.map(f => (
                <li key={f.id} className="py-3">
                  <div className="bg-gray-900 p-4 rounded-lg flex flex-col gap-2 shadow-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className="font-bold text-lg text-blue-200">{f.data}</span>
                      <div className="flex flex-wrap gap-4 text-gray-400 text-sm">
                        <span>Total: <b>R$ {f.totais?.total?.toFixed(2) || 0}</b></span>
                        <span>Dinheiro: R$ {f.totais?.dinheiro?.toFixed(2) || 0}</span>
                        <span>Maquininha: R$ {f.totais?.maquininha?.toFixed(2) || 0}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleSelectFechamento(f)} className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded font-bold flex-1">Ver</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {selectedFechamento && (
          <div className="bg-gray-900 p-6 rounded-lg mb-4 border border-blue-700 shadow-lg">
            <h3 className="text-lg font-bold mb-2 text-blue-200">Fechamento de {selectedFechamento.data}</h3>
            <div className="mb-2">Total: <span className="text-blue-300">R$ {selectedFechamento.totais?.total?.toFixed(2) || 0}</span></div>
            <div className="mb-2">Dinheiro: <span className="text-green-400">R$ {selectedFechamento.totais?.dinheiro?.toFixed(2) || 0}</span></div>
            <div className="mb-2">Maquininha: <span className="text-purple-400">R$ {selectedFechamento.totais?.maquininha?.toFixed(2) || 0}</span></div>
            <div className="mb-2">Vendas com Alerta: <span className="text-yellow-400">{selectedFechamento.totais?.alertas || 0}</span></div>
            <div className="mb-2">Itens Vendidos:
              <ul className="ml-4">
                {selectedFechamento.totais && Object.entries(selectedFechamento.totais.itens || {}).map(([nome, qtd]) => (
                  <li key={nome}>{nome}: <span className="text-blue-200 font-bold">{qtd}</span></li>
                ))}
              </ul>
            </div>
            <h4 className="font-bold mt-4 mb-2 text-blue-200">Vendas</h4>
            <div className="space-y-2">
              {selectedFechamento.vendas.map(v => (
                <div key={v.id || v.data + v.vendedor} className="bg-gray-800 p-3 rounded flex flex-col md:flex-row md:items-center md:justify-between shadow">
                  {editVenda === v.id ? (
                    <div className="flex flex-col md:flex-row md:items-center w-full gap-2">
                      <select
                        className="text-black p-1 rounded"
                        value={editVendaData.vendedor}
                        onChange={e => setEditVendaData({ ...editVendaData, vendedor: e.target.value })}
                      >
                        <option value="">Selecione o funcionário</option>
                        {funcionarios.map(f => (
                          <option key={f.id} value={f.nome}>{f.nome.charAt(0).toUpperCase() + f.nome.slice(1).toLowerCase()}</option>
                        ))}
                      </select>
                      <input type="datetime-local" className="text-black p-1 rounded" value={editVendaData.data ? editVendaData.data.slice(0, 16) : ""} onChange={e => setEditVendaData({ ...editVendaData, data: e.target.value })} />
                      <input type="text" className="text-black p-1 rounded" value={editVendaData.observacao || ""} onChange={e => setEditVendaData({ ...editVendaData, observacao: e.target.value })} placeholder="Observação" />
                      {/* Itens e pagamentos igual tela de vendas */}
                      <span className="text-blue-200 font-bold">Itens:</span>
                      {editVendaData.itens.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input type="text" className="p-1 rounded text-black w-32" value={item.produto} onChange={e => {
                            const novos = [...editVendaData.itens];
                            novos[idx].produto = e.target.value;
                            setEditVendaData({ ...editVendaData, itens: novos });
                          }} />
                          <input type="number" className="p-1 rounded text-black w-20" value={item.quantidade} onChange={e => {
                            const novos = [...editVendaData.itens];
                            novos[idx].quantidade = Number(e.target.value);
                            setEditVendaData({ ...editVendaData, itens: novos });
                          }} min={1} />
                        </div>
                      ))}
                      <span className="text-blue-200 font-bold">Pagamentos:</span>
                      {editVendaData.pagamentos.map((pag, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <select className="p-1 rounded text-black w-32" value={pag.forma} onChange={e => {
                            const novos = [...editVendaData.pagamentos];
                            novos[idx].forma = e.target.value;
                            setEditVendaData({ ...editVendaData, pagamentos: novos });
                          }}>
                            <option value="dinheiro">Dinheiro</option>
                            <option value="pix">Pix</option>
                            <option value="credito">Crédito</option>
                            <option value="debito">Débito</option>
                          </select>
                          <input type="number" className="p-1 rounded text-black w-20" value={pag.valor} onChange={e => {
                            const novos = [...editVendaData.pagamentos];
                            novos[idx].valor = e.target.value;
                            setEditVendaData({ ...editVendaData, pagamentos: novos });
                          }} min={0} />
                        </div>
                      ))}
                      <button onClick={handleSaveEditVenda} className="bg-green-600 px-2 py-1 rounded font-bold">Salvar</button>
                      <button onClick={() => setEditVenda(null)} className="bg-gray-500 px-2 py-1 rounded font-bold">Cancelar</button>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row md:items-center w-full gap-2">
                      <span className="font-bold">{v.vendedor.charAt(0).toUpperCase() + v.vendedor.slice(1).toLowerCase()}</span>
                      <span className="text-sm text-gray-400">{new Date(v.data).toLocaleString()}</span>
                      <span>Itens: {v.itens.map(i => `${i.produto} (${i.quantidade})`).join(", ")}</span>
                      <span>Pagamentos: {v.pagamentos.map(p => `${p.forma}: R$${p.valor}`).join(", ")}</span>
                      {v.observacao && <span className="text-yellow-300">Obs: {v.observacao}</span>}
                      <button onClick={() => handleEditVenda(v)} className="bg-yellow-500 px-2 py-1 rounded font-bold">Editar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Adicionar nova venda ao fechamento */}
            <div className="mt-6 bg-gray-800 p-4 rounded">
              <h5 className="font-bold mb-2 text-blue-200">Adicionar Venda ao Fechamento</h5>
              <select
                className="text-black p-1 rounded mb-2 w-full"
                value={novaVenda.vendedor}
                onChange={e => setNovaVenda({ ...novaVenda, vendedor: e.target.value })}
              >
                <option value="">Selecione o funcionário</option>
                {funcionarios.map(f => (
                  <option key={f.id} value={f.nome}>{f.nome.charAt(0).toUpperCase() + f.nome.slice(1).toLowerCase()}</option>
                ))}
              </select>
              <input type="datetime-local" className="text-black p-1 rounded mb-2 w-full" placeholder="Data" value={novaVenda.data} onChange={e => setNovaVenda({ ...novaVenda, data: e.target.value })} />
              <input type="text" className="text-black p-1 rounded mb-2 w-full" placeholder="Observação" value={novaVenda.observacao} onChange={e => setNovaVenda({ ...novaVenda, observacao: e.target.value })} />
              <span className="text-blue-200 font-bold">Itens:</span>
              {novaVenda.itens && novaVenda.itens.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input type="text" className="p-1 rounded text-black w-32" value={item.produto} onChange={e => {
                    const novos = [...novaVenda.itens];
                    novos[idx].produto = e.target.value;
                    setNovaVenda({ ...novaVenda, itens: novos });
                  }} />
                  <input type="number" className="p-1 rounded text-black w-20" value={item.quantidade} onChange={e => {
                    const novos = [...novaVenda.itens];
                    novos[idx].quantidade = Number(e.target.value);
                    setNovaVenda({ ...novaVenda, itens: novos });
                  }} min={1} />
                </div>
              ))}
              <span className="text-blue-200 font-bold">Pagamentos:</span>
              {novaVenda.pagamentos && novaVenda.pagamentos.map((pag, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select className="p-1 rounded text-black w-32" value={pag.forma} onChange={e => {
                    const novos = [...novaVenda.pagamentos];
                    novos[idx].forma = e.target.value;
                    setNovaVenda({ ...novaVenda, pagamentos: novos });
                  }}>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="pix">Pix</option>
                    <option value="credito">Crédito</option>
                    <option value="debito">Débito</option>
                  </select>
                  <input type="number" className="p-1 rounded text-black w-20" value={pag.valor} onChange={e => {
                    const novos = [...novaVenda.pagamentos];
                    novos[idx].valor = e.target.value;
                    setNovaVenda({ ...novaVenda, pagamentos: novos });
                  }} min={0} />
                </div>
              ))}
              <button onClick={handleAddVendaToFechamento} className="bg-green-600 px-3 py-1 rounded font-bold text-white w-full">Adicionar Venda</button>
            </div>
            <button onClick={() => setSelectedFechamento(null)} className="mt-4 bg-gray-700 hover:bg-gray-800 px-4 py-2 rounded font-bold">Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Fechamento;
