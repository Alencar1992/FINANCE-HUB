import { Download } from "lucide-react";
import { money } from "../../lib/finance";
import { MovementList } from "../movements/MovementList";

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function buildMovementsCsv(rows) {
  return [
    "Nome,Categoria,Data,Tipo,Valor",
    ...rows.map((row) =>
      [row.name, row.cat, row.date, row.type, row.value]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n");
}

export function ReportsModule({ tx }) {
  const income = tx
    .filter((row) => row.type === "in")
    .reduce((total, row) => total + Number(row.value), 0);
  const expense = tx
    .filter((row) => row.type === "out")
    .reduce((total, row) => total + Number(row.value), 0);

  function exportCsv() {
    const url = URL.createObjectURL(
      new Blob([buildMovementsCsv(tx)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "finance-hub.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  return (
    <div className="page-panel">
      <div className="page-head">
        <div>
          <h2>Relatórios</h2>
          <p>Resumo baseado nas movimentações reais.</p>
        </div>
        <button className="primary" onClick={exportCsv} disabled={!tx.length}>
          <Download />
          Exportar CSV
        </button>
      </div>
      <div className="report-grid">
        <div>
          <span>Receitas</span>
          <strong className="pos">{money(income)}</strong>
        </div>
        <div>
          <span>Despesas</span>
          <strong className="neg">{money(expense)}</strong>
        </div>
        <div>
          <span>Resultado</span>
          <strong>{money(income - expense)}</strong>
        </div>
        <div>
          <span>Lançamentos</span>
          <strong>{tx.length}</strong>
        </div>
      </div>
      <MovementList
        rows={tx}
        title="Detalhamento"
        description="Consulte as movimentações incluídas neste resumo."
      />
    </div>
  );
}
