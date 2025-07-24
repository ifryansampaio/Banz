// Utilitários para sincronização offline/online

// Salva um array de objetos no localStorage
export function saveLocal(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Lê um array de objetos do localStorage
export function loadLocal(key) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

// Marca itens como pendentes de sincronização
export function addPendingSync(key, item) {
  const pendentes = loadLocal(key + "_pendentes");
  pendentes.push(item);
  saveLocal(key + "_pendentes", pendentes);
}

// Remove item sincronizado
export function removePendingSync(key, id) {
  let pendentes = loadLocal(key + "_pendentes");
  pendentes = pendentes.filter(i => i.id !== id);
  saveLocal(key + "_pendentes", pendentes);
}

// Retorna todos os pendentes
export function getPendingSync(key) {
  return loadLocal(key + "_pendentes");
}
