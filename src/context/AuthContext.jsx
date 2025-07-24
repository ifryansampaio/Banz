import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [loja, setLojaState] = useState(() => {
    const saved = localStorage.getItem("loja");
    return saved ? JSON.parse(saved) : null;
  });
  const [funcionario, setFuncionarioState] = useState(() => {
    const saved = localStorage.getItem("funcionario");
    return saved ? JSON.parse(saved) : null;
  });

  const setLoja = (loja) => {
    setLojaState(loja);
    if (loja) localStorage.setItem("loja", JSON.stringify(loja));
    else localStorage.removeItem("loja");
  };
  const setFuncionario = (func) => {
    setFuncionarioState(func);
    if (func) localStorage.setItem("funcionario", JSON.stringify(func));
    else localStorage.removeItem("funcionario");
  };

  const logout = () => {
    setLoja(null);
    setFuncionario(null);
    localStorage.removeItem("loja");
    localStorage.removeItem("funcionario");
  };

  return (
    <AuthContext.Provider value={{ loja, setLoja, funcionario, setFuncionario, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
