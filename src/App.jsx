import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Vender from "./pages/Vender";
import Vendas from "./pages/Vendas";
import Estoque from "./pages/Estoque";
import Fechamento from "./pages/Fechamento";
import Administrar from "./pages/Administrar";
import Login from "./pages/Login";
import LojaLogin from "./pages/LojaLogin";
import Transferencias from "./pages/Transferencias";
import Entradas from "./pages/Entradas";
import TodasEntradas from "./pages/TodasEntradas";
import TodasTransferencias from "./pages/TodasTransferencias";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { db } from "./firebase/config";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";

// Função global para fechamento automático
async function autoFechamentoGlobal(loja) {
  if (!loja) return;
  const hoje = new Date();
  const hojeStr = hoje.toISOString().slice(0, 10);
  const q = query(collection(db, "fechamentos"), where("loja", "==", loja.nome));
  const fechamentosSnap = await getDocs(q);
  const datasFechadas = fechamentosSnap.docs.map(doc => doc.data().data);
  // Busca vendas não fechadas
  const vendasSnap = await getDocs(query(collection(db, "vendas"), where("loja", "==", loja.nome)));
  const vendasPendentes = vendasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  // Descobrir datas de vendas
  const datasVendas = vendasPendentes.map(v => v.data.slice(0, 10));
  // Fechamento só se houver vendas
  for (const dataVenda of datasVendas) {
    if (dataVenda < hojeStr && !datasFechadas.includes(dataVenda)) {
      const vendasDoDia = vendasPendentes.filter(v => v.data.slice(0, 10) === dataVenda);
      // Calcular totais igual ao Fechamento.jsx
      let total = 0, dinheiro = 0, maquininha = 0, alertas = 0, itens = {};
      vendasDoDia.forEach((v) => {
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
}

const AppRoutes = () => {
  const { funcionario, loja } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();
  React.useEffect(() => {
    autoFechamentoGlobal(loja);
  }, [loja]);

  // Redirecionamento automático na raiz
  if (location.pathname === "/") {
    if (!loja) return <Navigate to="/selecionar-loja" replace />;
    if (!funcionario) return <Navigate to="/login" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  if (!loja && location.pathname !== "/selecionar-loja") return <Navigate to="/selecionar-loja" replace />;
  if (loja && !funcionario && location.pathname !== "/login") return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-gray-900">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <main className="flex-1 bg-gray-900 text-white overflow-x-auto">
        <Routes>
          <Route path="/selecionar-loja" element={<LojaLogin />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/vender" element={<Vender />} />
          <Route path="/entradas" element={<Entradas />} />
          <Route path="/todas-entradas" element={<TodasEntradas />} />
          <Route path="/transferencias" element={<Transferencias />} />
          <Route path="/todas-transferencias" element={<TodasTransferencias />} />
          <Route path="/vendas" element={<Vendas />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/fechamento" element={<Fechamento />} />
          <Route path="/administrar" element={<Administrar />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
};

export default App;
