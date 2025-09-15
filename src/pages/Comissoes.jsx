import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";

const Comissoes = () => {
  const { funcionario } = useAuth();
  const [pendentes, setPendentes] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [showPagos, setShowPagos] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComissoes = async () => {
      setLoading(true);
      const vendasSnap = await getDocs(query(collection(db, "vendas"), where("valorComissao", ">", 0)));
      const vendas = vendasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPendentes(vendas.filter(v => !v.comissaoPaga).sort((a, b) => new Date(b.data) - new Date(a.data)));
      setPagos(vendas.filter(v => v.comissaoPaga).sort((a, b) => new Date(b.data) - new Date(a.data)));
      setLoading(false);
    };
    fetchComissoes();
  }, [showPagos]);

    const marcarComoPago = async (id, formaPagamentoComissao) => {
      await updateDoc(doc(db, "vendas", id), {
        comissaoPaga: true,
        dataPagamentoComissao: new Date().toISOString(),
        usuarioPagamentoComissao: funcionario?.nome || "",
        formaPagamentoComissao: formaPagamentoComissao
      });
      setPendentes(pendentes.filter(v => v.id !== id));
      setPagos([
        ...pagos,
        {
          ...pendentes.find(v => v.id === id),
          comissaoPaga: true,
          dataPagamentoComissao: new Date().toISOString(),
          usuarioPagamentoComissao: funcionario?.nome || "",
          formaPagamentoComissao
        }
      ]);
    };

  const desfazerPagamento = async (id) => {
    await updateDoc(doc(db, "vendas", id), { comissaoPaga: false, dataPagamentoComissao: null });
    setPagos(pagos.filter(v => v.id !== id));
    setPendentes([...pendentes, { ...pagos.find(v => v.id === id), comissaoPaga: false, dataPagamentoComissao: null }]);
  };



  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <div className="flex-1 w-full max-w-3xl mx-auto p-2 sm:p-4 md:p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-300">Comissões</h1>
          <button
            className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded font-bold text-white text-sm shadow-md"
            onClick={() => setShowPagos(!showPagos)}
          >
            {showPagos ? "Ver Pendentes" : "Histórico de Pagos"}
          </button>
        </div>
        <div className="bg-gray-800 p-2 sm:p-6 rounded-lg shadow-lg">
          {loading ? (
            <div className="text-gray-400">Carregando...</div>
          ) : showPagos ? (
            <>
              <h2 className="text-xl font-semibold mb-4 text-green-400">Comissões Pagas</h2>
              <ul className="divide-y divide-gray-700">
                {pagos.length === 0 && <li className="text-gray-400">Nenhuma comissão paga.</li>}
                {pagos.map((c) => (
                  <li key={c.id} className="py-3">
                    <div className="bg-gray-900 p-4 rounded-lg flex flex-col gap-4 shadow-lg">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-bold text-lg text-blue-200">{c.comissionado}</span>
                        <span className="font-bold text-green-300">R$ {c.valorComissao?.toFixed(2)}
                          <span className="ml-2 text-xs text-gray-400">({c.formaPagamentoComissao === "pix" ? "Pix" : "Dinheiro"})</span>
                        </span>
                        <span className="text-xs text-gray-400">{new Date(c.data).toLocaleString()}</span>
                          <span className="text-xs text-gray-400">Pago em: {c.dataPagamentoComissao ? new Date(c.dataPagamentoComissao).toLocaleString() : '-'} </span>
                          <span className="text-xs text-gray-400">Por: {c.usuarioPagamentoComissao || '-'}</span>
                      </div>
                      <button
                        className="bg-yellow-600 hover:bg-yellow-700 px-3 py-2 rounded font-bold text-white text-sm w-full sm:w-auto"
                        onClick={() => desfazerPagamento(c.id)}
                      >Desfazer</button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-4 text-yellow-400">Comissões Pendentes</h2>
              <ul className="divide-y divide-gray-700">
                {pendentes.length === 0 && <li className="text-gray-400">Nenhuma comissão pendente.</li>}
                {pendentes.map((c) => (
                  <li key={c.id} className="py-3">
                    <ComissaoPendenteItem comissao={c} marcarComoPago={marcarComoPago} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
};


// Componente para item de comissão pendente com select de forma de pagamento
function ComissaoPendenteItem({ comissao, marcarComoPago }) {
  const [forma, setForma] = useState("dinheiro");
  return (
    <div className="bg-gray-900 p-4 rounded-lg flex flex-col gap-4 shadow-lg">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-bold text-lg text-blue-200">{comissao.comissionado}</span>
        <span className="font-bold text-yellow-300">R$ {comissao.valorComissao?.toFixed(2)}</span>
        <span className="text-xs text-gray-400">{new Date(comissao.data).toLocaleString()}</span>
      </div>
      <div className="flex gap-2 items-center">
        <select className="p-2 rounded text-black" value={forma} onChange={e => setForma(e.target.value)}>
          <option value="dinheiro">Dinheiro</option>
          <option value="pix">Pix</option>
        </select>
        <button
          className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded font-bold text-white text-sm w-full sm:w-auto"
          onClick={() => marcarComoPago(comissao.id, forma)}
        >Marcar como Pago</button>
      </div>
    </div>
  );
}

export default Comissoes;
