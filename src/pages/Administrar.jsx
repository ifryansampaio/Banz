import React, { useEffect, useState } from "react";
import { db } from "../firebase/config";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { getTotalEstoquePorLoja } from "../utils/estoque";
import { registrarLog } from "../utils/log";
import { exportarBackupFirestore } from "../utils/backup";
import Fechamento from "./Fechamento";

const Administrar = () => {
  const [funcionarios, setFuncionarios] = useState([]);
  const [novoFunc, setNovoFunc] = useState({ nome: "", senha: "" });
  const [editandoFunc, setEditandoFunc] = useState(null);
  const [acessoAdmin, setAcessoAdmin] = useState(false);
  const [senhaAdmin, setSenhaAdmin] = useState("");
  const [lojas, setLojas] = useState([]);
  const [novaLoja, setNovaLoja] = useState({ nome: "" });
  const [editandoLoja, setEditandoLoja] = useState(null);
  const [estoquePorLoja, setEstoquePorLoja] = useState({});
  const [logs, setLogs] = useState([]);
  const [logLojaFiltro, setLogLojaFiltro] = useState("");
  const [logTipoFiltro, setLogTipoFiltro] = useState("");
  const [logDataFiltro, setLogDataFiltro] = useState("");
  const senhaCorreta = "pk8533";

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    const funcsSnap = await getDocs(collection(db, "funcionarios"));
    setFuncionarios(funcsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    const lojasSnap = await getDocs(collection(db, "lojas"));
    const lojasList = lojasSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setLojas(lojasList);
    // Buscar total de estoque para cada loja
    const estoqueObj = {};
    for (const loja of lojasList) {
      estoqueObj[loja.id] = await getTotalEstoquePorLoja(loja.nome);
    }
    setEstoquePorLoja(estoqueObj);
  };

  const adicionarFuncionario = async () => {
    if (!novoFunc.nome || !novoFunc.senha) return;
    // Verifica se já existe funcionário com o mesmo nome
    const jaExiste = funcionarios.some(f => f.nome.toLowerCase() === novoFunc.nome.toLowerCase());
    if (jaExiste) return;
    await addDoc(collection(db, "funcionarios"), { ...novoFunc, nome: novoFunc.nome.toLowerCase() });
    await registrarLog({
      acao: "adicionar",
      alvo: "funcionario",
      usuario: "admin",
      loja: "-",
      detalhes: { funcionario: novoFunc.nome }
    });
    setNovoFunc({ nome: "", senha: "" });
    carregarDados();
  };

  const salvarEdicaoFunc = async (func) => {
    const funcRef = doc(db, "funcionarios", func.id);
    await updateDoc(funcRef, { nome: func.nome.toLowerCase(), senha: func.senha });
    await registrarLog({
      acao: "editar",
      alvo: "funcionario",
      usuario: "admin",
      loja: "-",
      detalhes: { funcionario: func.nome }
    });
    setEditandoFunc(null);
    carregarDados();
  };

  const excluirFuncionario = async (id) => {
    const confirmar = window.confirm("Deseja mesmo excluir este funcionário?");
    if (!confirmar) return;
    const senha = window.prompt("Digite a senha de administrador para confirmar:");
    if (senha !== senhaCorreta) {
      alert("Senha incorreta. Exclusão cancelada.");
      return;
    }
    const func = funcionarios.find(f => f.id === id);
    await deleteDoc(doc(db, "funcionarios", id));
    await registrarLog({
      acao: "excluir",
      alvo: "funcionario",
      usuario: "admin",
      loja: "-",
      detalhes: { funcionario: func ? func.nome : id }
    });
    carregarDados();
  };

  const adicionarLoja = async () => {
    if (!novaLoja.nome) return;
    // Verifica se já existe loja com o mesmo nome
    const jaExiste = lojas.some(l => l.nome.toLowerCase() === novaLoja.nome.toLowerCase());
    if (jaExiste) return;
    await addDoc(collection(db, "lojas"), { nome: novaLoja.nome });
    await registrarLog({
      acao: "adicionar",
      alvo: "loja",
      usuario: "admin",
      loja: novaLoja.nome,
      detalhes: { loja: novaLoja.nome }
    });
    setNovaLoja({ nome: "" });
    carregarDados();
  };

  const salvarEdicaoLoja = async (loja) => {
    const lojaRef = doc(db, "lojas", loja.id);
    await updateDoc(lojaRef, { nome: loja.nome });
    await registrarLog({
      acao: "editar",
      alvo: "loja",
      usuario: "admin",
      loja: loja.nome,
      detalhes: { loja: loja.nome }
    });
    setEditandoLoja(null);
    carregarDados();
  };

  const excluirLoja = async (id) => {
    const confirmar = window.confirm("Deseja mesmo excluir esta loja?");
    if (!confirmar) return;
    const senha = window.prompt("Digite a senha de administrador para confirmar:");
    if (senha !== senhaCorreta) {
      alert("Senha incorreta. Exclusão cancelada.");
      return;
    }
    const loja = lojas.find(l => l.id === id);
    await deleteDoc(doc(db, "lojas", id));
    await registrarLog({
      acao: "excluir",
      alvo: "loja",
      usuario: "admin",
      loja: loja ? loja.nome : id,
      detalhes: { loja: loja ? loja.nome : id }
    });
    carregarDados();
  };

  // Relatório de auditoria/logs
  const carregarLogs = async () => {
    const snap = await getDocs(collection(db, "logs"));
    setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    carregarLogs();
  }, []);

  if (!acessoAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
        <div className="bg-gray-800 p-6 rounded shadow w-80">
          <h2 className="text-xl mb-4 text-center">Acesso Administrador</h2>
          <input
            type="password"
            placeholder="Senha do Administrador"
            className="w-full p-2 mb-2 text-black"
            value={senhaAdmin}
            onChange={e => setSenhaAdmin(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (senhaAdmin === senhaCorreta) setAcessoAdmin(true);
                else setSenhaAdmin("");
              }
            }}
          />
          <button
            className="bg-blue-600 w-full py-2 rounded"
            onClick={() => {
              if (senhaAdmin === senhaCorreta) setAcessoAdmin(true);
              else setSenhaAdmin("");
            }}
          >
            Entrar
          </button>
          {senhaAdmin !== "" && senhaAdmin !== senhaCorreta && (
            <div className="text-red-400 mt-2">Senha incorreta!</div>
          )}
        </div>
      </div>
    );
  }

  // Garante que sempre retorna o conteúdo principal
  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <div className="flex-1 w-full max-w-4xl mx-auto p-2 sm:p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6 text-blue-300 text-center sm:text-left">Painel de Administração</h1>
        <div className="bg-gray-800 p-2 sm:p-6 rounded-lg shadow-lg overflow-x-auto">
          <button
            className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded font-bold text-white mb-6"
            onClick={exportarBackupFirestore}
          >
            Baixar Backup Completo
          </button>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Lojas */}
            <div>
              <h2 className="text-xl mb-4 font-semibold text-blue-200">Lojas</h2>
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Nome da Loja"
                  className="p-3 border text-black rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={novaLoja.nome}
                  onChange={(e) => setNovaLoja({ nome: e.target.value })}
                />
                <button onClick={adicionarLoja} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-bold text-white">Adicionar</button>
              </div>
              <ul className="divide-y divide-gray-700">
                {lojas.map((loja) => (
                  <li key={loja.id} className="py-3">
                    {editandoLoja && editandoLoja.id === loja.id ? (
                      <div className="bg-gray-900 p-4 rounded-lg flex flex-col gap-2 shadow-lg">
                        <input
                          type="text"
                          className="text-black p-1 rounded"
                          value={editandoLoja.nome}
                          onChange={e => setEditandoLoja({ ...editandoLoja, nome: e.target.value })}
                        />
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => salvarEdicaoLoja(editandoLoja)} className="bg-green-600 px-3 py-1 rounded font-bold text-white flex-1">Salvar</button>
                          <button onClick={() => setEditandoLoja(null)} className="bg-gray-500 px-3 py-1 rounded font-bold text-white flex-1">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-900 p-4 rounded-lg flex flex-col gap-2 shadow-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <span className="font-bold text-lg text-blue-200">{loja.nome}</span>
                          <span className="text-xs text-blue-200">Total em estoque: <b>{estoquePorLoja[loja.id] ?? '-'}</b> peças</span>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => setEditandoLoja({ ...loja })} className="bg-yellow-500 px-3 py-1 rounded font-bold flex-1">Editar</button>
                          <button onClick={() => excluirLoja(loja.id)} className="bg-red-600 px-3 py-1 rounded font-bold flex-1">Excluir</button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {/* Funcionários */}
            <div>
              <h2 className="text-xl mb-4 font-semibold text-blue-200">Funcionários</h2>
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Nome do Funcionário"
                  className="p-3 border text-black rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={novoFunc.nome}
                  onChange={(e) => setNovoFunc({ ...novoFunc, nome: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Senha"
                  className="p-3 border text-black rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={novoFunc.senha}
                  onChange={(e) => setNovoFunc({ ...novoFunc, senha: e.target.value })}
                />
                <button onClick={adicionarFuncionario} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-bold text-white">Adicionar</button>
              </div>
              <ul className="divide-y divide-gray-700">
                {funcionarios.map((func) => (
                  <li key={func.id} className="py-3">
                    {editandoFunc && editandoFunc.id === func.id ? (
                      <div className="bg-gray-900 p-4 rounded-lg flex flex-col gap-2 shadow-lg">
                        <input
                          type="text"
                          className="text-black p-1 rounded"
                          value={editandoFunc.nome}
                          onChange={e => setEditandoFunc({ ...editandoFunc, nome: e.target.value })}
                        />
                        <input
                          type="text"
                          className="text-black p-1 rounded"
                          value={editandoFunc.senha}
                          onChange={e => setEditandoFunc({ ...editandoFunc, senha: e.target.value })}
                        />
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => salvarEdicaoFunc(editandoFunc)} className="bg-green-600 px-3 py-1 rounded font-bold text-white flex-1">Salvar</button>
                          <button onClick={() => setEditandoFunc(null)} className="bg-gray-500 px-3 py-1 rounded font-bold text-white flex-1">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-900 p-4 rounded-lg flex flex-col gap-2 shadow-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <span className="font-bold text-lg text-blue-200">{func.nome.charAt(0).toUpperCase() + func.nome.slice(1).toLowerCase()}</span>
                          <span className="text-gray-400 text-sm">({func.senha})</span>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => setEditandoFunc({ ...func })} className="bg-yellow-500 px-3 py-1 rounded font-bold flex-1">Editar</button>
                          <button onClick={() => excluirFuncionario(func.id)} className="bg-red-600 px-3 py-1 rounded font-bold flex-1">Excluir</button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {/* Relatório de Auditoria */}
          <div className="mt-10">
            <h2 className="text-xl mb-2 font-semibold text-blue-200">Relatório de Auditoria</h2>
            <div className="flex gap-2 mb-2 flex-wrap">
              <select className="text-black p-1 rounded" value={logLojaFiltro} onChange={e => setLogLojaFiltro(e.target.value)}>
                <option value="">Todas as lojas</option>
                {lojas.map(l => <option key={l.id} value={l.nome}>{l.nome}</option>)}
              </select>
              <select className="text-black p-1 rounded" value={logTipoFiltro} onChange={e => setLogTipoFiltro(e.target.value)}>
                <option value="">Todas as ações</option>
                <option value="adicionar">Adicionar</option>
                <option value="editar">Editar</option>
                <option value="excluir">Excluir</option>
              </select>
              <input type="date" className="text-black p-1 rounded" value={logDataFiltro} onChange={e => setLogDataFiltro(e.target.value)} />
              <button className="bg-blue-600 px-2 py-1 rounded text-white font-bold" onClick={carregarLogs}>Atualizar</button>
            </div>
            <div className="bg-gray-800 rounded p-2 max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-blue-300">
                    <th className="text-left">Data/Hora</th>
                    <th className="text-left">Loja</th>
                    <th className="text-left">Usuário</th>
                    <th className="text-left">Ação</th>
                    <th className="text-left">Alvo</th>
                    <th className="text-left">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {logs
                    .filter(l => (!logLojaFiltro || l.loja === logLojaFiltro))
                    .filter(l => (!logTipoFiltro || l.acao.startsWith(logTipoFiltro)))
                    .filter(l => (!logDataFiltro || l.dataHora.slice(0,10) === logDataFiltro))
                    .sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora))
                    .map(l => (
                      <tr key={l.id} className="border-b border-gray-700">
                        <td>{new Date(l.dataHora).toLocaleString()}</td>
                        <td>{l.loja}</td>
                        <td>{l.usuario}</td>
                        <td>{l.acao}</td>
                        <td>{l.alvo}</td>
                        <td><pre className="whitespace-pre-wrap">{JSON.stringify(l.detalhes, null, 1)}</pre></td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {logs.length === 0 && <div className="text-gray-400 p-2">Nenhum registro encontrado.</div>}
            </div>
          </div>
          <div className="mt-8">
            <Fechamento />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Administrar;
