import React, { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { collection, addDoc, getDocs, updateDoc, doc, query, where } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

const Emprestimos = () => {
  const { funcionario, loja } = useAuth();
  const [emprestimos, setEmprestimos] = useState([]);
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState("dinheiro");
  const [origem, setOrigem] = useState("");
  const [loading, setLoading] = useState(true);
  const [historico, setHistorico] = useState([]);

  useEffect(() => {
    if (!loja) return;
    const fetchEmprestimos = async () => {
      setLoading(true);
      const q = query(collection(db, "emprestimos"), where("loja", "==", loja.nome));
      const snap = await getDocs(q);
      const ativos = [];
      const devolvidos = [];
      snap.docs.forEach(docu => {
        const e = { id: docu.id, ...docu.data() };
        if (e.devolvido) devolvidos.push(e);
        else ativos.push(e);
      });
      ativos.sort((a, b) => new Date(b.data) - new Date(a.data));
      devolvidos.sort((a, b) => new Date(b.dataDevolucao || 0) - new Date(a.dataDevolucao || 0));
      setEmprestimos(ativos);
      setHistorico(devolvidos);
      setLoading(false);
    };
    fetchEmprestimos();
  }, [loja]);

  const registrarEmprestimo = async () => {
    if (!valor || !origem || !loja) return;
    const agora = new Date();
    await addDoc(collection(db, "emprestimos"), {
      valor: Number(valor),
      forma,
      origem,
      loja: loja.nome,
      registradoPor: funcionario?.nome || "",
      data: agora.toISOString(),
      devolvido: false,
    });
    setValor("");
    setOrigem("");
    setForma("dinheiro");
    // Atualiza lista
    const q = query(collection(db, "emprestimos"), where("loja", "==", loja.nome));
    const snap = await getDocs(q);
    setEmprestimos(snap.docs.filter(d => !d.data().devolvido).map(d => ({ id: d.id, ...d.data() })));
  };

  const devolverEmprestimo = async (id, formaDevolucao) => {
    const agora = new Date();
    await updateDoc(doc(db, "emprestimos", id), {
      devolvido: true,
      formaDevolucao,
      usuarioDevolucao: funcionario?.nome || "",
      dataDevolucao: agora.toISOString(),
    });
    // Atualiza lista
    const q = query(collection(db, "emprestimos"), where("loja", "==", loja.nome));
    const snap = await getDocs(q);
    setEmprestimos(snap.docs.filter(d => !d.data().devolvido).map(d => ({ id: d.id, ...d.data() })));
    setHistorico(snap.docs.filter(d => d.data().devolvido).map(d => ({ id: d.id, ...d.data() })));
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white items-center">
      <div className="w-full max-w-2xl p-4">
        <h1 className="text-3xl font-bold mb-6 text-blue-300 text-center">Empréstimos</h1>
        <div className="mb-6 bg-gray-800 p-4 rounded-lg">
          <h2 className="text-xl font-bold text-green-300 mb-2">Registrar Empréstimo</h2>
          <div className="flex gap-2 mb-2">
            <input type="text" className="p-2 rounded text-black w-32" placeholder="Origem" value={origem} onChange={e => setOrigem(e.target.value)} />
            <input type="number" className="p-2 rounded text-black w-24" placeholder="Valor" value={valor} onChange={e => setValor(e.target.value)} />
            <select className="p-2 rounded text-black w-24" value={forma} onChange={e => setForma(e.target.value)}>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">Pix</option>
            </select>
            <button className="bg-green-600 px-3 py-1 rounded text-white font-bold" onClick={registrarEmprestimo}>Registrar</button>
          </div>
        </div>
        <div className="mb-6 bg-gray-800 p-4 rounded-lg">
          <h2 className="text-xl font-bold text-yellow-300 mb-2">Empréstimos Ativos</h2>
          {loading ? <div className="text-blue-200">Carregando...</div> : (
            <ul className="divide-y divide-gray-700">
              {emprestimos.length === 0 && <li className="text-gray-400">Nenhum empréstimo ativo.</li>}
              {emprestimos.map(e => (
                <li key={e.id} className="py-2 flex flex-col gap-1">
                  <span><span className="font-bold">Origem:</span> {e.origem}</span>
                  <span><span className="font-bold">Valor:</span> R$ {Number(e.valor).toFixed(2)}</span>
                  <span><span className="font-bold">Forma:</span> {e.forma}</span>
                  <span><span className="font-bold">Registrado por:</span> {e.registradoPor}</span>
                  <span><span className="font-bold">Data:</span> {new Date(e.data).toLocaleString()}</span>
                  <div className="flex gap-2 mt-2">
                    <button className="bg-green-600 px-3 py-1 rounded text-white font-bold" onClick={() => devolverEmprestimo(e.id, "dinheiro")}>Devolver em Dinheiro</button>
                    <button className="bg-blue-600 px-3 py-1 rounded text-white font-bold" onClick={() => devolverEmprestimo(e.id, "pix")}>Devolver em Pix</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mb-6 bg-gray-800 p-4 rounded-lg">
          <h2 className="text-xl font-bold text-blue-200 mb-2">Histórico de Empréstimos Devolvidos</h2>
          <ul className="divide-y divide-gray-700">
            {historico.length === 0 && <li className="text-gray-400">Nenhum empréstimo devolvido.</li>}
            {historico.map(e => (
              <li key={e.id} className="py-2 flex flex-col gap-1">
                <span><span className="font-bold">Origem:</span> {e.origem}</span>
                <span><span className="font-bold">Valor:</span> R$ {Number(e.valor).toFixed(2)}</span>
                <span><span className="font-bold">Forma:</span> {e.forma}</span>
                <span><span className="font-bold">Registrado por:</span> {e.registradoPor}</span>
                <span><span className="font-bold">Data:</span> {new Date(e.data).toLocaleString()}</span>
                <span><span className="font-bold">Devolvido por:</span> {e.usuarioDevolucao || '-'}</span>
                <span><span className="font-bold">Forma de devolução:</span> {e.formaDevolucao || '-'}</span>
                <span><span className="font-bold">Data de devolução:</span> {e.dataDevolucao ? new Date(e.dataDevolucao).toLocaleString() : '-'}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Emprestimos;
