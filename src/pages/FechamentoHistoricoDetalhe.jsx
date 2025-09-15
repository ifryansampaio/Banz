import React from "react";

const FechamentoHistoricoDetalhe = ({ fechamento, onClose }) => {
  if (!fechamento) return null;
  const { vendas = [], sangrias = [], emprestimos = [] } = fechamento;
  // Empréstimos pendentes e pagos
  const emprestimosPendentes = Array.isArray(emprestimos) ? emprestimos.filter(e => !e.devolvido) : [];
  const emprestimosPagos = Array.isArray(emprestimos) ? emprestimos.filter(e => e.devolvido) : [];
  // Alerta se houver empréstimos pendentes
  const alertaEmprestimos = emprestimosPendentes.length > 0;
  // Lista de peças vendidas
  const pecasVendidas = [];
  vendas.forEach(v => {
    if (v.itens && Array.isArray(v.itens)) {
      v.itens.forEach(i => {
        const idx = pecasVendidas.findIndex(p => p.produto === i.produto);
        if (idx >= 0) {
          pecasVendidas[idx].quantidade += i.quantidade;
        } else {
          pecasVendidas.push({ produto: i.produto, quantidade: i.quantidade });
        }
      });
    }
  });
  // Lista de comissões feitas
  const comissoesPendentes = vendas.filter(v => v.valorComissao > 0 && !v.comissaoPaga);
  const comissoesPagas = vendas.filter(v => v.valorComissao > 0 && v.comissaoPaga);
  const comissoes = vendas
    .filter(v => v.valorComissao && v.comissionado)
    .map(v => ({ nome: v.comissionado, valor: v.valorComissao }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-0 sm:p-4 rounded-lg shadow-lg max-w-2xl w-full relative overflow-y-auto max-h-[90vh]">
        {/* Close button (X) */}
        <button onClick={onClose} className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 rounded-full w-10 h-10 flex items-center justify-center text-white font-bold text-xl z-10" aria-label="Fechar">×</button>
        <div className="p-4">
          <h2 className="text-2xl font-bold text-blue-300 mb-2 text-center">Fechamento de {fechamento.data}</h2>
          <div className="mb-2 text-center">
            <span className="font-bold text-green-300">Loja:</span> {fechamento.loja}
          </div>
          <div className="mb-2 text-center">
            <span className="font-bold text-blue-300">Vendas Totais:</span> R$ {fechamento.totais?.total?.toFixed(2) || "0.00"}
          </div>
          <div className="mb-2 text-center">
            <span className="font-bold text-pink-400">Lucro Bruto:</span> R$ {fechamento.totais?.lucroBruto !== undefined ? fechamento.totais.lucroBruto.toFixed(2) : "0.00"}
          </div>
          <div className="mb-2 text-center">
            <span className="font-bold text-yellow-400">Comissões:</span> R$ {fechamento.vendas ? fechamento.vendas.reduce((sum, v) => sum + (v.valorComissao || 0), 0).toFixed(2) : "0.00"}
          </div>
          {/* Peças Vendidas */}
          <div className="mb-4">
            <h3 className="text-lg font-bold text-blue-200 mb-2">Peças Vendidas</h3>
            <ul className="divide-y divide-gray-700">
              {pecasVendidas.length === 0 && <li className="text-gray-400">Nenhuma peça vendida.</li>}
              {pecasVendidas.map((p, idx) => (
                <li key={idx} className="py-1 flex justify-between">
                  <span>{p.produto}</span>
                  <span className="font-bold">{p.quantidade}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Comissões Pendentes */}
          <div className="mb-4">
            <h3 className="text-lg font-bold text-yellow-200 mb-2">Comissões Pendentes</h3>
            <ul className="divide-y divide-gray-700">
              {comissoesPendentes.length === 0 && <li className="text-gray-400">Nenhuma comissão pendente.</li>}
              {comissoesPendentes.map((v, idx) => (
                <li key={idx} className="py-1 flex justify-between">
                  <span>{v.comissionado}</span>
                  <span className="font-bold">R$ {Number(v.valorComissao).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Comissões Pagas */}
          <div className="mb-4">
            <h3 className="text-lg font-bold text-green-200 mb-2">Comissões Pagas</h3>
            <ul className="divide-y divide-gray-700">
              {comissoesPagas.length === 0 && <li className="text-gray-400">Nenhuma comissão paga.</li>}
              {comissoesPagas.map((v, idx) => (
                <li key={idx} className="py-1 flex justify-between">
                  <span>{v.comissionado}</span>
                  <span className="font-bold">R$ {Number(v.valorComissao).toFixed(2)}
                    <span className="ml-2 text-xs text-gray-400">({v.formaPagamentoComissao === "pix" ? "Pix" : "Dinheiro"})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {/* Empréstimos */}
          <div className="mb-4">
            <h3 className="text-lg font-bold text-yellow-300 mb-2">Empréstimos Pendentes</h3>
            <ul className="divide-y divide-gray-700">
              {emprestimosPendentes.length === 0 && <li className="text-gray-400">Nenhum empréstimo pendente.</li>}
              {emprestimosPendentes.map((e, idx) => (
                <li key={idx} className="py-1 flex justify-between">
                  <span>{e.origem}</span>
                  <span className="font-bold">R$ {Number(e.valor).toFixed(2)} ({e.forma})</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-green-300 mb-2">Empréstimos Pagos</h3>
            <ul className="divide-y divide-gray-700">
              {emprestimosPagos.length === 0 && <li className="text-gray-400">Nenhum empréstimo pago.</li>}
              {emprestimosPagos.map((e, idx) => (
                <li key={idx} className="py-1 flex justify-between">
                  <span>{e.origem}</span>
                  <span className="font-bold">R$ {Number(e.valor).toFixed(2)} ({e.formaDevolucao || e.forma})</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Vendas do Dia */}
          <div className="mb-4">
            <h3 className="text-lg font-bold text-green-200 mb-2">Vendas do Dia</h3>
            <ul className="divide-y divide-gray-700">
              {vendas.length === 0 && <li className="text-gray-400">Nenhuma venda registrada.</li>}
              {vendas.map((v, idx) => (
                <li key={idx} className="py-2">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-blue-200">Vendedor: {v.vendedor || '-'}</span>
                    <span>Itens: {v.itens ? v.itens.map(i => `${i.produto} (${i.quantidade})`).join(", ") : '-'}</span>
                    <span>Pagamentos: {v.pagamentos ? v.pagamentos.map(p => `${p.forma}: R$${p.valor}`).join(", ") : '-'}</span>
                    {v.valorComissao > 0 && <span className="text-pink-400 font-bold">Comissão: R$ {Number(v.valorComissao).toFixed(2)}</span>}
                    {v.observacao && <span className="text-yellow-300">Obs: {v.observacao}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {/* Sangrias/Puxadores */}
          <div className="mb-2">
            <h3 className="text-lg font-bold text-red-200 mb-2">Sangrias/Puxadores</h3>
            <ul className="divide-y divide-gray-700">
              {sangrias.length === 0 && <li className="text-gray-400">Nenhuma sangria registrada.</li>}
              {sangrias.map((s, idx) => (
                <li key={idx} className="py-1 flex justify-between">
                  <span>{s.para || '-'}</span>
                  <span className="font-bold">R$ {Number(s.valor).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FechamentoHistoricoDetalhe;
