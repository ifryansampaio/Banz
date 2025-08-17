import React, { useEffect, useState } from "react";

import { collection, onSnapshot, query, where, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import { exportarBackupFirestore } from "../utils/backup";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
  const { loja } = useAuth();
  const [vendas, setVendas] = useState([]);
  const [totalDinheiro, setTotalDinheiro] = useState(0);
  const [totalMaquininha, setTotalMaquininha] = useState(0);
  const [total, setTotal] = useState(0);
  const [totaisPorItem, setTotaisPorItem] = useState({});
  // --- Fechamento diário ---
  const [fechando, setFechando] = useState(false);
  const [fechamentoFeitoHoje, setFechamentoFeitoHoje] = useState(false);
  // --- Sangrias ---
  const [sangrias, setSangrias] = useState([]);
  useEffect(() => {
    if (!loja) return;
    const hojeStr = new Date().toLocaleDateString("en-CA");
    const q = query(
      collection(db, "sangrias"),
      where("loja", "==", loja.nome),
      where("data", "==", hojeStr)
    );
    getDocs(q).then((snap) => {
      const arr = [];
      snap.forEach((doc) => arr.push({ id: doc.id, ...doc.data() }));
      setSangrias(arr);
    });
  }, [loja, fechando]);
  useEffect(() => {
    if (!loja) return;
    const checkFechamento = async () => {
      const hojeStr = new Date().toISOString().slice(0, 10);
      const fechamentosSnap = await getDocs(query(collection(db, "fechamentos"), where("loja", "==", loja.nome), where("data", "==", hojeStr)));
      setFechamentoFeitoHoje(!fechamentosSnap.empty);
    };
    checkFechamento();
  }, [loja, fechando]);
  const fecharDia = async () => {
    if (!loja) return;
    if (fechamentoFeitoHoje) {
      alert("O fechamento já foi realizado hoje para esta loja.");
      return;
    }
    if (!window.confirm("Tem certeza que deseja realizar o fechamento do dia? Esta ação não pode ser desfeita.")) {
      return;
    }
    setFechando(true);
    const hoje = new Date();
    // Filtra vendas do dia (corrigido para comparar datas locais)
    const hojeStr = hoje.toLocaleDateString('en-CA'); // yyyy-mm-dd
    const vendasHoje = vendas.filter(v => {
      if (!v.data) return false;
      const dataVenda = new Date(v.data).toLocaleDateString('en-CA');
      return dataVenda === hojeStr;
    });
    if (vendasHoje.length === 0) {
      alert("Não há vendas para fechar hoje.");
      setFechando(false);
      return;
    }
    // Calcula totais
    let total = 0;
    let dinheiro = 0;
    let maquininha = 0;
    let alertas = 0;
    let itens = {};
    vendasHoje.forEach((v) => {
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
    const totais = { total, dinheiro, maquininha, alertas, itens };
    // Busca sangrias do dia para salvar no fechamento
    const sangriasSnap = await getDocs(query(
      collection(db, "sangrias"),
      where("loja", "==", loja.nome),
      where("data", "==", hojeStr)
    ));
    const sangriasDoDia = [];
    sangriasSnap.forEach((doc) => sangriasDoDia.push({ id: doc.id, ...doc.data() }));
    await addDoc(collection(db, "fechamentos"), {
      loja: loja.nome,
      data: hojeStr,
      vendas: vendasHoje,
      totais,
      sangrias: sangriasDoDia,
    });
    // Remove vendas fechadas
    for (const v of vendasHoje) {
      await deleteDoc(doc(db, "vendas", v.id));
    }
    // Remove sangrias do dia
    for (const s of sangriasDoDia) {
      await deleteDoc(doc(db, "sangrias", s.id));
    }
    await exportarBackupFirestore();
    setFechando(false);
    setFechamentoFeitoHoje(true);
    alert("Fechamento realizado com sucesso!");
  };

  useEffect(() => {
    if (!loja) return;
    const q = query(collection(db, "vendas"), where("loja", "==", loja.nome));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setVendas(lista);

      let somaDinheiro = 0;
      let somaMaquininha = 0;
      let itemTotais = {};
      lista.forEach((v) => {
        v.pagamentos.forEach((p) => {
          if (p.forma === "dinheiro") somaDinheiro += parseFloat(p.valor || 0);
          else if (["pix", "credito", "debito"].includes(p.forma)) somaMaquininha += parseFloat(p.valor || 0);
        });
        v.itens.forEach((i) => {
          itemTotais[i.produto] = (itemTotais[i.produto] || 0) + i.quantidade;
        });
      });
      setTotalDinheiro(somaDinheiro);
      setTotalMaquininha(somaMaquininha);
      setTotal(somaDinheiro + somaMaquininha);
      setTotaisPorItem(itemTotais);
    });
    return () => unsubscribe();
  }, [loja]);

  // Cálculos de sangria
  const totalSangrias = sangrias.reduce((sum, s) => sum + (s.valor || 0), 0);
  const dinheiroEmMaos = totalDinheiro - totalSangrias;

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <div className="flex-1 w-full max-w-4xl mx-auto p-2 sm:p-4 md:p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-300 text-center sm:text-left">Dashboard</h1>
          <button
            onClick={fecharDia}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-bold text-white text-sm shadow-md"
            disabled={fechando || fechamentoFeitoHoje}
            style={{ minWidth: 120 }}
          >
            {fechando ? "Fechando..." : fechamentoFeitoHoje ? "Fechamento já feito" : "Fechar o Dia"}
          </button>
        </div>
        <div className="bg-gray-800 p-2 sm:p-6 rounded-lg shadow-lg overflow-x-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-800 to-blue-600 p-6 rounded-lg shadow-lg text-white flex flex-col items-center">
              <span className="text-2xl font-bold">R$ {total.toFixed(2)}</span>
              <span className="text-lg mt-2">Total</span>
            </div>
            <div className="bg-gradient-to-br from-green-700 to-green-500 p-6 rounded-lg shadow-lg text-white flex flex-col items-center">
              <span className="text-2xl font-bold">R$ {totalDinheiro.toFixed(2)}</span>
              <span className="text-lg mt-2">Dinheiro Total</span>
            </div>
            <div className="bg-gradient-to-br from-purple-700 to-purple-500 p-6 rounded-lg shadow-lg text-white flex flex-col items-center">
              <span className="text-2xl font-bold">R$ {totalMaquininha.toFixed(2)}</span>
              <span className="text-lg mt-2">Maquininha</span>
            </div>
            <div className="bg-gradient-to-br from-yellow-700 to-yellow-500 p-6 rounded-lg shadow-lg text-white flex flex-col items-center">
              <span className="text-2xl font-bold">R$ {dinheiroEmMaos.toFixed(2)}</span>
              <span className="text-lg mt-2">Dinheiro em Mãos</span>
            </div>
            <div className="bg-gradient-to-br from-red-700 to-red-500 p-6 rounded-lg shadow-lg text-white flex flex-col items-center">
              <span className="text-2xl font-bold">R$ {totalSangrias.toFixed(2)}</span>
              <span className="text-lg mt-2">Sangrias/Puxadores</span>
            </div>
          </div>
          {/* Sangrias realizadas */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-4">
            <h2 className="text-xl font-semibold mb-4 text-red-400">Sangrias realizadas</h2>
            <ul className="divide-y divide-gray-700">
              {sangrias.length === 0 && <li className="text-gray-400">Nenhuma sangria registrada hoje.</li>}
              {sangrias.map((s) => (
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
          {/* Itens vendidos */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-blue-200">Itens Vendidos</h2>
            <ul className="divide-y divide-gray-700">
              {Object.entries(totaisPorItem)
                .sort((a, b) => a[0].replace(/(\d+)/g, n => n.padStart(10, '0')).localeCompare(b[0].replace(/(\d+)/g, n => n.padStart(10, '0')), 'pt-BR', { sensitivity: 'base' }))
                .map(([nome, qtd]) => (
                  <li key={nome} className="py-3">
                    <div className="bg-gray-900 p-4 rounded-lg flex flex-col gap-2 shadow-lg">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <span className="font-bold text-lg text-blue-200">{nome}</span>
                        <span className="font-bold text-blue-300">{qtd}</span>
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
