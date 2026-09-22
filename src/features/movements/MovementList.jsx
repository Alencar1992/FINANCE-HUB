import { useState } from "react";
import {
  MoreHorizontal,
  PackageOpen,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { money } from "../../lib/finance";

function EmptyState({ text }) {
  return (
    <div className="module-empty">
      <PackageOpen />
      <strong>{text}</strong>
      <span>Use o botão de cadastro para começar.</span>
    </div>
  );
}

export function MovementList({
  rows,
  open,
  onEdit,
  title = "Movimentações",
  description = "Acompanhe todas as entradas e saídas.",
}) {
  const [filter, setFilter] = useState("all");
  const shown = rows.filter((row) => filter === "all" || row.type === filter);

  return (
    <div className="page-panel">
      <div className="page-head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {open ? (
          <button className="primary" onClick={open}>
            <Plus />
            Adicionar
          </button>
        ) : null}
      </div>
      <div className="filters">
        <button
          className={filter === "all" ? "selected" : ""}
          onClick={() => setFilter("all")}
        >
          Todas
        </button>
        <button
          className={filter === "in" ? "selected" : ""}
          onClick={() => setFilter("in")}
        >
          Receitas
        </button>
        <button
          className={filter === "out" ? "selected" : ""}
          onClick={() => setFilter("out")}
        >
          Despesas
        </button>
      </div>
      <div className="table">
        {shown.map((row) => (
          <div className="tr" key={row.id}>
            <i className={row.type === "in" ? "txicon in" : "txicon out"}>
              {row.type === "in" ? <TrendingUp /> : <TrendingDown />}
            </i>
            <div>
              <strong>{row.name}</strong>
              <span>{row.cat}</span>
            </div>
            <span>{row.date}</span>
            <span>{row.status}</span>
            <b className={row.type === "in" ? "pos" : "neg"}>
              {row.type === "in" ? "+ " : "- "}
              {money(row.value)}
            </b>
            {onEdit ? (
              <button
                aria-label={
                  row.editable === false
                    ? "Gerenciado pelo módulo de origem"
                    : "Editar movimentação"
                }
                disabled={row.editable === false}
                onClick={() => onEdit(row)}
                title={
                  row.editable === false
                    ? "Edite no módulo de origem"
                    : "Editar movimentação"
                }
              >
                <MoreHorizontal />
              </button>
            ) : null}
          </div>
        ))}
        {!shown.length ? (
          <EmptyState text="Nenhuma movimentação neste filtro." />
        ) : null}
      </div>
    </div>
  );
}
