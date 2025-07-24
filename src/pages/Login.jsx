import React, { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase/config";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const { loja, setLoja, funcionario, setFuncionario } = useAuth();
  const [step, setStep] = useState(loja ? "funcionario" : "loja");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [funcNome, setFuncNome] = useState("");
  const [funcSenha, setFuncSenha] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const seedFuncionario = async () => {
      const q = query(collection(db, "funcionarios"), where("nome", "==", "soul"));
      const snap = await getDocs(q);
      if (snap.empty) {
        await addDoc(collection(db, "funcionarios"), { nome: "soul", senha: "Ry3719" });
      }
    };
    seedFuncionario();
  }, []);

  const handleLojaLogin = async () => {
    try {
      setError("");
      // Buscar loja pelo nome selecionado (agora vem do contexto)
      setLoja(loja); // loja já foi definida na seleção
      setStep("funcionario");
    } catch (err) {
      setError("Selecione uma loja válida.");
    }
  };

  const handleFuncionarioLogin = async () => {
    try {
      const q = query(collection(db, "funcionarios"), where("nome", "==", funcNome.toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setError("Funcionário não encontrado.");
        return;
      }
      const func = snap.docs[0].data();
      if (func.senha !== funcSenha) {
        setError("Senha incorreta para funcionário.");
        return;
      }
      // Exibe nome com inicial maiúscula
      setFuncionario({ ...func, nome: func.nome.charAt(0).toUpperCase() + func.nome.slice(1).toLowerCase() });
      window.location.href = "/dashboard";
    } catch (err) {
      setError("Erro ao verificar funcionário.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-900 to-gray-900 text-white">
      <div className="flex-1 w-full max-w-md mx-auto p-2 sm:p-4 md:p-6 flex items-center justify-center">
        <div className="w-full bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col gap-6">
          <h1 className="text-3xl mb-6 text-center font-bold text-blue-300">Login do Funcionário</h1>
          <input
            type="text"
            placeholder="Nome do Funcionário"
            className="w-full p-3 mb-3 text-black rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={funcNome}
            onChange={(e) => setFuncNome(e.target.value)}
          />
          <input
            type="password"
            placeholder="Senha do Funcionário"
            className="w-full p-3 mb-3 text-black rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={funcSenha}
            onChange={(e) => setFuncSenha(e.target.value)}
          />
          {error && <div className="text-red-400 mb-2 text-center">{error}</div>}
          <button
            onClick={handleFuncionarioLogin}
            className="bg-blue-600 hover:bg-blue-700 transition w-full py-3 rounded font-bold text-lg"
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
