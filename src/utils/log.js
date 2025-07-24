import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * Registra uma ação de auditoria no Firestore
 * @param {Object} param0
 * @param {string} param0.acao - Ex: 'adicionar', 'editar', 'excluir'
 * @param {string} param0.alvo - Ex: 'produto', 'venda', 'funcionario', 'loja'
 * @param {string} param0.usuario - Nome do usuário que fez a ação
 * @param {string} param0.loja - Nome da loja relacionada
 * @param {Object} [param0.detalhes] - Objeto com detalhes da ação (ex: antes/depois)
 */
export async function registrarLog({ acao, alvo, usuario, loja, detalhes }) {
  try {
    await addDoc(collection(db, "logs"), {
      acao,
      alvo,
      usuario,
      loja,
      detalhes: detalhes || null,
      dataHora: new Date().toISOString(),
    });
  } catch (e) {
    // Não bloqueia a ação principal se o log falhar
    console.error("Erro ao registrar log de auditoria:", e);
  }
}
