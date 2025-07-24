import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

const LojaLogin = () => {
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const { setLoja } = useAuth();

  useEffect(() => {
    // Tenta carregar lojas do localStorage primeiro para exibir instantaneamente
    const cached = localStorage.getItem("lojas_cache");
    if (cached) setLojas(JSON.parse(cached));
    const fetchLojas = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "lojas"));
        const lojasList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLojas(lojasList);
        localStorage.setItem("lojas_cache", JSON.stringify(lojasList));
      } catch (e) {
        setLojas([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLojas();
  }, []);

  const handleSelect = (e) => {
    setSelected(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selected) {
      const loja = lojas.find(l => l.id === selected);
      setLoja(loja);
    }
  };

  if (loading && lojas.length === 0) return <div>Carregando lojas...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <div className="flex-1 w-full max-w-md mx-auto p-2 sm:p-4 md:p-6 flex items-center justify-center">
        <form onSubmit={handleSubmit} className="w-full bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col gap-6">
          <h2 className="text-3xl font-bold text-blue-300 text-center">Selecione a Loja</h2>
          <select value={selected} onChange={handleSelect} className="text-black p-3 rounded w-full mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">Escolha uma loja</option>
            {lojas.map(loja => (
              <option key={loja.id} value={loja.id}>{loja.nome}</option>
            ))}
          </select>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 transition px-6 py-2 rounded text-white font-semibold w-full" disabled={!selected}>
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
};

export default LojaLogin;
