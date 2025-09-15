import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Ícones modernos (Heroicons SVG inline)
const icons = {
  dashboard: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8v-10h-8v10zm0-18v6h8V3h-8z" /></svg>
  ), // Dashboard: antigo, cards
  vender: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 10c-4.418 0-8-1.79-8-4V7a2 2 0 012-2h12a2 2 0 012 2v7c0 2.21-3.582 4-8 4z" /></svg>
  ), // Vender: antigo, moeda
  transferencias: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4-4 4M3 12h18" /></svg>
  ), // Transferências: seta dupla
  entradas: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
  ), // Entradas: cruz
  fechamento: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8" /></svg>
  ), // Fechamento: círculo e linha vertical
  administrar: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
  ), // Administrar: quadrado
  logout: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>
  ), // Logout: seta para fora
};

const Sidebar = ({ open, setOpen }) => {
  const { funcionario, loja, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    if (window.confirm("Deseja mesmo deslogar?")) {
      logout();
      navigate("/login");
    }
  };

  // Fecha menu ao navegar
  const handleNav = () => setOpen(false);

  return (
    <>
      {/* Botão hambúrguer visível apenas em telas pequenas */}
      <button
        className="fixed top-4 left-4 z-50 bg-blue-700 p-2 rounded shadow-lg md:hidden"
        aria-label="Abrir menu"
        onClick={() => setOpen(true)}
        style={{ display: open ? 'none' : 'block' }}
      >
        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      {/* Sidebar para desktop e drawer para mobile */}
      <div
        className={`fixed inset-0 z-40 bg-black bg-opacity-40 transition-opacity duration-300 md:hidden ${open ? 'block opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setOpen(false)}
        style={{display: open ? 'block' : 'none'}}
      />
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-gradient-to-b from-gray-900 to-blue-900 text-white p-6 flex flex-col justify-between shadow-2xl transform transition-transform duration-300 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'} md:static md:flex md:translate-x-0`}
        style={{ minHeight: '100vh' }}
        aria-label="Menu lateral"
      >
        <div>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-extrabold text-blue-300 tracking-wide">Banz</h2>
            {/* Botão fechar no mobile */}
            <button className="md:hidden p-2" aria-label="Fechar menu" onClick={() => setOpen(false)}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="mb-6 text-gray-300 bg-gray-700 rounded p-3 shadow flex flex-col gap-1">
            <span className="text-xs">Usuário logado:</span>
            <span className="font-bold text-lg text-white">{funcionario ? (funcionario.nome.charAt(0).toUpperCase() + funcionario.nome.slice(1).toLowerCase()) : "-"}</span>
            <span className="text-xs">Loja atual:</span>
            <span className="font-bold text-blue-400">{loja ? loja.nome : "-"}</span>
          </div>
          <nav className="flex flex-col gap-3">
            <Link to="/" onClick={handleNav} className="hover:bg-blue-700 transition p-3 rounded text-lg font-medium flex items-center gap-3">
              {icons.dashboard} <span>Dashboard</span>
            </Link>
            <Link to="/emprestimos" onClick={handleNav} className="hover:bg-blue-700 transition p-3 rounded text-lg font-medium flex items-center gap-3">
              {icons.entradas} <span>Empréstimos</span>
            </Link>
            <Link to="/vender" onClick={handleNav} className="hover:bg-blue-700 transition p-3 rounded text-lg font-medium flex items-center gap-3">
              {icons.vender} <span>Vender</span>
            </Link>
            <Link to="/sangrias" onClick={handleNav} className="hover:bg-blue-700 transition p-3 rounded text-lg font-medium flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m0 0l-3-3m3 3l3-3M5 12a7 7 0 1114 0 7 7 0 01-14 0z" /></svg>
              <span>Sangrias</span>
            </Link>
            <Link to="/entradas" onClick={handleNav} className="hover:bg-blue-700 transition p-3 rounded text-lg font-medium flex items-center gap-3">
              {icons.entradas} <span>Entradas</span>
            </Link>
            <Link to="/transferencias" onClick={handleNav} className="hover:bg-blue-700 transition p-3 rounded text-lg font-medium flex items-center gap-3">
              {icons.transferencias} <span>Transferências</span>
            </Link>
            {funcionario?.administrador && (
              <>
                <Link to="/administrar" onClick={handleNav} className="hover:bg-blue-700 transition p-3 rounded text-lg font-medium flex items-center gap-3">
                  {icons.administrar} <span>Administrar</span>
                </Link>
                <Link to="/comissoes" onClick={handleNav} className="hover:bg-yellow-700 transition p-3 rounded text-lg font-medium flex items-center gap-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 10c-4.418 0-8-1.79-8-4V7a2 2 0 012-2h12a2 2 0 012 2v7c0 2.21-3.582 4-8 4z" /></svg>
                  <span>Comissões</span>
                </Link>
                  <Link to="/fechamento-historico" onClick={handleNav} className="hover:bg-pink-700 transition p-3 rounded text-lg font-medium flex items-center gap-3">
                    {icons.fechamento} <span>Fechamento Histórico</span>
                  </Link>
              </>
            )}
          </nav>
        </div>
        <button
          onClick={handleLogout}
          className="mt-8 bg-red-600 hover:bg-red-700 p-3 rounded font-bold text-lg shadow-lg transition flex items-center gap-3 justify-center"
        >
          {icons.logout} <span>Sair</span>
        </button>
      </aside>
    </>
  );
};

export default Sidebar;
