// offlineSync.js - Gerencia fila offline de vendas usando localForage (IndexedDB)
import localforage from "localforage";

localforage.config({
  name: "banca-app",
  storeName: "offline_sales"
});

const SALES_KEY = "pending_sales";

export async function addPendingSale(sale) {
  const sales = (await localforage.getItem(SALES_KEY)) || [];
  sales.push({ ...sale, pending: true, synced: false });
  await localforage.setItem(SALES_KEY, sales);
}

export async function getPendingSales() {
  return (await localforage.getItem(SALES_KEY)) || [];
}

export async function markSaleSynced(localId, firestoreId) {
  const sales = (await localforage.getItem(SALES_KEY)) || [];
  const idx = sales.findIndex(s => s.id === localId);
  if (idx !== -1) {
    sales[idx].pending = false;
    sales[idx].synced = true;
    sales[idx].firestoreId = firestoreId;
    await localforage.setItem(SALES_KEY, sales);
  }
}

export async function markSaleDeleted(localId) {
  const sales = (await localforage.getItem(SALES_KEY)) || [];
  const idx = sales.findIndex(s => s.id === localId);
  if (idx !== -1) {
    sales[idx].deleted = true;
    await localforage.setItem(SALES_KEY, sales);
  }
}

export async function markSaleEdited(localId, newData) {
  const sales = (await localforage.getItem(SALES_KEY)) || [];
  const idx = sales.findIndex(s => s.id === localId);
  if (idx !== -1) {
    sales[idx] = { ...sales[idx], ...newData, edited: true };
    await localforage.setItem(SALES_KEY, sales);
  }
}

export async function removeSale(localId) {
  const sales = (await localforage.getItem(SALES_KEY)) || [];
  const filtered = sales.filter(s => s.id !== localId);
  await localforage.setItem(SALES_KEY, filtered);
}

export async function clearPendingSales() {
  await localforage.setItem(SALES_KEY, []);
}

// Sincroniza todas as vendas pendentes com o Firestore
export async function syncPendingSales({ db, loja, onSynced, onError }) {
  const sales = (await localforage.getItem(SALES_KEY)) || [];
  let syncedCount = 0;
  for (const sale of sales) {
    try {
      if (sale.deleted) {
        // Excluir do Firestore
        if (sale.firestoreId) {
          await import("firebase/firestore").then(({ doc, deleteDoc }) =>
            deleteDoc(doc(db, "vendas", sale.firestoreId))
          );
        }
        await removeSale(sale.id);
        syncedCount++;
        continue;
      }
      if (sale.edited) {
        // Atualizar no Firestore
        if (sale.firestoreId) {
          await import("firebase/firestore").then(({ doc, updateDoc }) =>
            updateDoc(doc(db, "vendas", sale.firestoreId), sale)
          );
          await markSaleSynced(sale.id, sale.firestoreId);
        } else {
          // Se não tem firestoreId, cria nova venda e marca como sincronizada
          const { addDoc, collection } = await import("firebase/firestore");
          const docRef = await addDoc(collection(db, "vendas"), sale);
          await markSaleSynced(sale.id, docRef.id);
        }
        syncedCount++;
        continue;
      }
      if (sale.pending && !sale.synced) {
        // Adicionar ao Firestore
        const { addDoc, collection } = await import("firebase/firestore");
        const docRef = await addDoc(collection(db, "vendas"), sale);
        await markSaleSynced(sale.id, docRef.id);
        syncedCount++;
      }
    } catch (e) {
      if (onError) onError(e, sale);
    }
  }
  if (onSynced) onSynced(syncedCount);
}

// Sincroniza automaticamente ao voltar online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    syncPendingSales({
      onSynced: (count) => {
        if (count > 0) {
          window.dispatchEvent(new CustomEvent("pendingSalesSynced"));
        }
      }
    });
  });
}
