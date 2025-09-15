import React, { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";

const EditarVenda = ({ vendaId, onClose, onSave }) => {
  const [venda, setVenda] = useState(null);
  const [comissionado, setComissionado] = useState("");
  const [valorComissao, setValorComissao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const fetchVenda = async () => {
      const docRef = doc(db, "vendas", vendaId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setVenda({ id: snap.id, ...snap.data() });
        setComissionado(snap.data().comissionado || "");
        setValorComissao(snap.data().valorComissao || "");
      }
    };
    if (vendaId) fetchVenda();
  }, [vendaId]);

  const handleSave = async () => {
    setSalvando(true);
    try {
      await updateDoc(doc(db, "vendas", vendaId), {
        comissionado,
        valorComissao: comissionado && valorComissao ? Number(valorComissao) : null,
      });
      if (onSave) onSave();
      onClose();
    } catch (e) {
      alert("Erro ao salvar edição da venda.");
    } finally {
      setSalvando(false);
    }
  };

  if (!venda) return <div className="p-4">Carregando venda...</div>;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-6 rounded-lg shadow-lg w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-2 right-2 bg-red-600 px-3 py-1 rounded text-white font-bold">Fechar</button>
        <h2 className="text-xl font-bold text-blue-300 mb-4">Editar Venda</h2>
        <div className="mb-4">
          <label className="block text-gray-300 mb-1">Comissionado</label>
          <input type="text" className="w-full p-2 rounded bg-gray-800 text-white" value={comissionado} onChange={e => setComissionado(e.target.value)} />
        </div>
        <div className="mb-4">
          <label className="block text-gray-300 mb-1">Valor Comissão</label>
          <input type="number" className="w-full p-2 rounded bg-gray-800 text-white" value={valorComissao} onChange={e => setValorComissao(e.target.value)} />
        </div>
        <button className="bg-green-600 px-4 py-2 rounded text-white font-bold w-full" onClick={handleSave} disabled={salvando}>Salvar</button>
      </div>
    </div>
  );
};

export default EditarVenda;
