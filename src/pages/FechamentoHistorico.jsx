import React, { useEffect, useState } from "react";
import FechamentoHistoricoDetalhe from "./FechamentoHistoricoDetalhe";
import { doc, deleteDoc } from "firebase/firestore";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

const FechamentoHistorico = () => {
  const { funcionario } = useAuth();
  const [historico, setHistorico] = useState([]);
  const [produtosEstoque, setProdutosEstoque] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalheFechamento, setDetalheFechamento] = useState(null);
  const [lojas, setLojas] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState("");

  useEffect(() => {
    const fetchLojas = async () => {
      const snap = await getDocs(collection(db, "lojas"));
      setLojas(snap.docs.map(doc => doc.data().nome));
    };
    fetchLojas();
  }, []);

  useEffect(() => {
    if (!lojaSelecionada) {
      setProdutosEstoque([]);
      return;
    }
    const fetchProdutos = async () => {
      const q = query(collection(db, "produtos"), where("loja", "==", lojaSelecionada));
      const snap = await getDocs(q);
      setProdutosEstoque(snap.docs.map(doc => doc.data()));
    };
    fetchProdutos();
  }, [lojaSelecionada]);

  useEffect(() => {
    if (!lojaSelecionada) {
      setHistorico([]);
      return;
    }
    setLoading(true);
    const fetchFechamentos = async () => {
      const snap = await getDocs(collection(db, "fechamentos"));
      const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(f => f.loja === lojaSelecionada);
      // Ordena por data decrescente (mais recente primeiro)
      lista.sort((a, b) => {
        // Se data for string yyyy-mm-dd, comparar como string
        if (a.data && b.data) return b.data.localeCompare(a.data);
        // Se data for Date, comparar como Date
        return new Date(b.data) - new Date(a.data);
      });
      setHistorico(lista);
      setLoading(false);
    };
    fetchFechamentos();
  }, [lojaSelecionada]);

  if (!funcionario?.administrador) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-900 text-white items-center justify-center">
        <h1 className="text-2xl font-bold text-red-400">Acesso restrito a administradores</h1>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <div className="flex-1 w-full max-w-4xl mx-auto p-2 sm:p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6 text-blue-300 text-center sm:text-left">Histórico de Fechamentos</h1>
        <div className="mb-6">
          <label className="font-bold text-blue-200 mr-2">Loja:</label>
          <select
            className="p-2 rounded text-black"
            value={lojaSelecionada}
            onChange={e => setLojaSelecionada(e.target.value)}
          >
            <option value="">Selecione a loja</option>
            {lojas.map(nome => (
              <option key={nome} value={nome}>{nome}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <div className="text-center text-blue-200">Carregando...</div>
        ) : (
          <ul className="divide-y divide-gray-700">
            {historico.length === 0 && <li className="text-gray-400">Nenhum fechamento registrado para esta loja.</li>}
            {historico.map(f => (
              <li key={f.id} className="py-4">
                <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col gap-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-bold text-lg text-blue-200">{f.data}</span>
                    <span className="font-bold text-green-300">Loja: {f.loja}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-900 p-3 rounded-lg">
                      <span className="font-bold text-blue-300">Vendas Totais:</span> R$ {f.totais?.total?.toFixed(2) || "0.00"}
                    </div>
                    <div className="bg-gray-900 p-3 rounded-lg">
                      <span className="font-bold text-green-400">Dinheiro:</span> R$ {f.totais?.dinheiro?.toFixed(2) || "0.00"}
                    </div>
                    <div className="bg-gray-900 p-3 rounded-lg">
                      <span className="font-bold text-purple-400">Maquininha:</span> R$ {f.totais?.maquininha?.toFixed(2) || "0.00"}
                    </div>
                    <div className="bg-gray-900 p-3 rounded-lg">
                      <span className="font-bold text-red-400">Sangrias/Puxadores:</span> R$ {f.sangrias ? f.sangrias.reduce((sum, s) => sum + (s.valor || 0), 0).toFixed(2) : "0.00"}
                    </div>
                    <div className="bg-gray-900 p-3 rounded-lg">
                      <span className="font-bold text-yellow-400">Comissões:</span> R$ {f.vendas ? f.vendas.reduce((sum, v) => sum + (v.valorComissao || 0), 0).toFixed(2) : "0.00"}
                    </div>
                    <div className="bg-gray-900 p-3 rounded-lg">
                      <span className="font-bold text-pink-400">Lucro Bruto:</span> R$ {(
                        f.totais?.lucroBruto !== undefined
                          ? f.totais.lucroBruto.toFixed(2)
                          : f.vendas
                            ? (() => {
                                let lucroBrutoTotal = 0;
                                f.vendas.forEach((v) => {
                                  let totalVenda = v.pagamentos.reduce((sum, p) => sum + parseFloat(p.valor || 0), 0);
                                  let comissao = v.valorComissao || 0;
                                  let custoTotal = 0;
                                  if (v.itens && Array.isArray(v.itens)) {
                                    v.itens.forEach((i) => {
                                      let custoItem = i.custo !== undefined ? parseFloat(i.custo) : undefined;
                                      if (custoItem === undefined) {
                                        const prodEstoque = produtosEstoque.find(p => p.nome === i.produto);
                                        if (prodEstoque && prodEstoque.custo !== undefined) {
                                          custoItem = parseFloat(prodEstoque.custo);
                                        } else {
                                          custoItem = 0;
                                        }
                                      }
                                      custoTotal += custoItem * i.quantidade;
                                    });
                                  }
                                  lucroBrutoTotal += totalVenda - comissao - custoTotal;
                                });
                                return lucroBrutoTotal.toFixed(2);
                              })()
                            : "0.00"
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button className="bg-blue-600 px-3 py-1 rounded text-white font-bold" onClick={() => setDetalheFechamento(f)}>Ver Detalhes</button>
                      <button className="bg-red-600 px-3 py-1 rounded text-white font-bold" onClick={async () => {
                        if (window.confirm('Tem certeza que deseja apagar este fechamento?')) {
                          await deleteDoc(doc(db, 'fechamentos', f.id));
                          setHistorico(historico.filter(h => h.id !== f.id));
                        }
                      }}>Apagar</button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {detalheFechamento && (
        <FechamentoHistoricoDetalhe fechamento={detalheFechamento} onClose={() => setDetalheFechamento(null)} />
      )}
    </div>
  );
};

export default FechamentoHistorico;
