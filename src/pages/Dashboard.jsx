import React, { useEffect, useState } from "react";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
  const { loja } = useAuth();
  const [vendas, setVendas] = useState([]);
  const [totalDinheiro, setTotalDinheiro] = useState(0);
  const [totalMaquininha, setTotalMaquininha] = useState(0);
  const [total, setTotal] = useState(0);
  const [totaisPorItem, setTotaisPorItem] = useState({});

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

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <div className="flex-1 w-full max-w-4xl mx-auto p-2 sm:p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6 text-blue-300 text-center sm:text-left">Dashboard</h1>
        <div className="bg-gray-800 p-2 sm:p-6 rounded-lg shadow-lg overflow-x-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-800 to-blue-600 p-6 rounded-lg shadow-lg text-white flex flex-col items-center">
              <span className="text-2xl font-bold">R$ {total.toFixed(2)}</span>
              <span className="text-lg mt-2">Total</span>
            </div>
            <div className="bg-gradient-to-br from-green-700 to-green-500 p-6 rounded-lg shadow-lg text-white flex flex-col items-center">
              <span className="text-2xl font-bold">R$ {totalDinheiro.toFixed(2)}</span>
              <span className="text-lg mt-2">Dinheiro</span>
            </div>
            <div className="bg-gradient-to-br from-purple-700 to-purple-500 p-6 rounded-lg shadow-lg text-white flex flex-col items-center">
              <span className="text-2xl font-bold">R$ {totalMaquininha.toFixed(2)}</span>
              <span className="text-lg mt-2">Maquininha</span>
            </div>
          </div>
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
