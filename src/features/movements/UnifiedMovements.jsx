import { useCallback, useEffect, useState } from "react";
import {
  MoreHorizontal,
  PackageOpen,
  Plus,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { money, parseBRNumber } from "../../lib/finance";
import {
  fetchLinkedMovements,
  fetchMovementSource,
  removeFinancialMovement,
  updateFinancialMovement,
} from "./movements-service";
import {
  buildMovementPayload,
  mapLinkedMovements,
  movementValue,
} from "./movement-utils";

function EmptyState({ text }) {
  return (
    <div className="module-empty">
      <PackageOpen />
      <strong>{text}</strong>
      <span>Use o botão de cadastro para começar.</span>
    </div>
  );
}

function Modal({ title, close, children }) {
  return (
    <div className="modal-bg" onMouseDown={close}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            <p>Preencha os dados abaixo.</p>
          </div>
          <button onClick={close} aria-label="Fechar editor">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Transactions({ rows, open, onEdit }) {
  const [filter, setFilter] = useState("all");
  const shown = rows.filter((row) => filter === "all" || row.type === filter);

  return (
    <div className="page-panel">
      <div className="page-head">
        <div>
          <h2>Movimentações</h2>
          <p>Acompanhe todas as entradas e saídas.</p>
        </div>
        {open && (
          <button className="primary" onClick={open}>
            <Plus />
            Adicionar
          </button>
        )}
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
            <button
              aria-label={
                row.editable === false
                  ? "Gerenciado pelo módulo de origem"
                  : "Editar movimentação"
              }
              disabled={row.editable === false}
              onClick={() => onEdit?.(row)}
              title={
                row.editable === false
                  ? "Edite no módulo de origem"
                  : "Editar movimentação"
              }
            >
              <MoreHorizontal />
            </button>
          </div>
        ))}
        {!shown.length && (
          <EmptyState text="Nenhuma movimentação neste filtro." />
        )}
      </div>
    </div>
  );
}

export function UnifiedMovements({ owner, baseRows, open, notify, refresh }) {
  const [linked, setLinked] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const loadLinked = useCallback(async () => {
    const [obligations, purchases, charges] = await fetchLinkedMovements(owner.id);
    if (obligations.error || purchases.error || charges.error) {
      notify("Algumas movimentações vinculadas não puderam ser carregadas.");
      return;
    }
    setLinked(
      mapLinkedMovements(obligations.data, purchases.data, charges.data),
    );
  }, [notify, owner.id]);

  useEffect(() => {
    loadLinked();
  }, [loadLinked]);

  async function beginEdit(row) {
    const sourceType = row.sourceType || "transaction";
    const sourceId = row.sourceId || row.id;
    const { data, error } = await fetchMovementSource(
      owner.id,
      sourceType,
      sourceId,
    );
    if (error) {
      notify("Não foi possível abrir esta movimentação.");
      return;
    }
    setEditing({
      ...data,
      sourceType,
      sourceLabel: row.sourceLabel || "Movimentação manual",
    });
    setEditValue(
      movementValue(sourceType, data).toFixed(2).replace(".", ","),
    );
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const value = parseBRNumber(editValue);
    if (!Number.isFinite(value) || value <= 0) {
      notify("Informe um valor válido.");
      return;
    }
    setSaving(true);
    try {
      const payload = buildMovementPayload(
        editing.sourceType,
        form,
        value,
        editing,
      );
      const { error } = await updateFinancialMovement(
        owner.id,
        editing.sourceType,
        editing.id,
        payload,
      );
      if (error) {
        notify(
          `Não foi possível atualizar: ${error.message || "verifique os dados"}.`,
        );
        return;
      }
      setEditing(null);
      await Promise.all([refresh(), loadLinked()]);
      window.dispatchEvent(new Event("finance-data-changed"));
      notify("Movimentação e módulo de origem atualizados.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (saving) return;
    setSaving(true);
    try {
      const { data, error } = await removeFinancialMovement(
        owner.id,
        editing.sourceType,
        editing.id,
      );
      if (error) {
        notify("Não foi possível remover esta movimentação com segurança.");
        return;
      }
      setEditing(null);
      await Promise.all([refresh(), loadLinked()]);
      window.dispatchEvent(new Event("finance-data-changed"));
      notify(
        data?.status === "already_removed"
          ? "A movimentação já estava removida."
          : "Movimentação e vínculos removidos com segurança.",
      );
    } finally {
      setSaving(false);
    }
  }

  const sourceLabel = editing?.sourceLabel || "Movimentação manual";
  const isTransaction = editing?.sourceType === "transaction";
  const isObligation = editing?.sourceType === "obligation";
  const isCard = editing?.sourceType === "card_purchase";
  const isStreaming = editing?.sourceType === "subscription_charge";

  return (
    <>
      <Transactions
        rows={[...baseRows, ...linked]}
        open={open}
        onEdit={beginEdit}
      />
      {editing && (
        <Modal
          title="Editar movimentação"
          close={() => !saving && setEditing(null)}
        >
          <form
            className="form movement-unified-editor"
            onSubmit={saveEdit}
          >
            <div className="movement-source-badge">
              <span>Origem do lançamento</span>
              <strong>{sourceLabel}</strong>
              <small>
                As alterações serão refletidas automaticamente na tela de
                origem.
              </small>
            </div>
            {isTransaction && (
              <>
                <label>
                  Descrição
                  <input name="name" defaultValue={editing.name} required />
                </label>
                <label>
                  Categoria
                  <input
                    name="category"
                    defaultValue={editing.category}
                    required
                  />
                </label>
              </>
            )}
            {(isObligation || isCard || isStreaming) && (
              <label>
                {isObligation
                  ? "Pessoa ou empresa"
                  : isCard
                    ? "Responsável pela compra"
                    : "Participante"}
                <input
                  name="counterparty"
                  defaultValue={
                    isObligation
                      ? editing.counterparty_name
                      : isCard
                        ? editing.purchased_by
                        : editing.participant_name
                  }
                  required
                />
              </label>
            )}
            {(isObligation || isStreaming) && (
              <label>
                WhatsApp
                <input
                  name="phone"
                  defaultValue={editing.phone || ""}
                  inputMode="tel"
                  placeholder="5511999999999"
                />
              </label>
            )}
            {(isObligation || isCard) && (
              <label>
                Descrição
                <input
                  name="description"
                  defaultValue={editing.description}
                  required
                />
              </label>
            )}
            {isObligation && (
              <label>
                Categoria
                <input
                  name="category"
                  defaultValue={editing.category || "Outros"}
                  required
                />
              </label>
            )}
            <div className="fields">
              <label>
                Valor total
                <input
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                  inputMode="decimal"
                  required
                />
              </label>
              <label>
                {isStreaming ? "Vencimento" : "Data / primeiro vencimento"}
                <input
                  name="date"
                  type="date"
                  defaultValue={
                    isTransaction
                      ? editing.transaction_date
                      : isObligation
                        ? editing.next_due_date
                        : isCard
                          ? editing.first_due_date
                          : editing.due_date
                  }
                  required
                />
              </label>
            </div>
            {(isTransaction || isObligation || isCard) && (
              <label>
                Quantidade de parcelas
                <input
                  name="installments"
                  type="number"
                  min="1"
                  max="120"
                  defaultValue={
                    isTransaction
                      ? editing.installment_count
                      : isObligation
                        ? editing.installments
                        : editing.installment_count
                  }
                />
                <small>O valor mensal será recalculado automaticamente.</small>
              </label>
            )}
            {isTransaction && (
              <label>
                Tipo financeiro
                <select name="direction" defaultValue={editing.transaction_type}>
                  <option value="income">Receita / entrada</option>
                  <option value="expense">Despesa / saída</option>
                </select>
              </label>
            )}
            {isObligation && (
              <label>
                Tipo financeiro
                <select name="direction" defaultValue={editing.direction}>
                  <option value="receivable">Valor a receber</option>
                  <option value="payable">Valor a pagar</option>
                </select>
              </label>
            )}
            <label>
              Status
              <select name="status" defaultValue={editing.status}>
                {isTransaction ? (
                  <>
                    <option value="pending">Pendente</option>
                    <option value="received">Recebido</option>
                    <option value="paid">Pago</option>
                    <option value="overdue">Vencido</option>
                    <option value="cancelled">Cancelado</option>
                  </>
                ) : isObligation ? (
                  <>
                    <option value="open">Em aberto</option>
                    <option value="paid">Quitado</option>
                    <option value="overdue">Vencido</option>
                    <option value="cancelled">Cancelado</option>
                  </>
                ) : isCard ? (
                  <>
                    <option value="open">Em aberto</option>
                    <option value="paid">Pago</option>
                    <option value="cancelled">Cancelado</option>
                  </>
                ) : (
                  <>
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="overdue">Atrasado</option>
                    <option value="cancelled">Cancelado</option>
                  </>
                )}
              </select>
            </label>
            {isTransaction && (
              <>
                <label className="installment-toggle">
                  <input
                    name="recurring"
                    type="checkbox"
                    defaultChecked={editing.is_recurring}
                  />
                  Movimentação recorrente mensal
                </label>
                <label>
                  Dia do vencimento mensal
                  <input
                    name="recurrence_day"
                    type="number"
                    min="1"
                    max="31"
                    defaultValue={
                      editing.recurrence_day ||
                      new Date(`${editing.transaction_date}T12:00`).getDate()
                    }
                  />
                </label>
              </>
            )}
            {(isTransaction || isObligation) && (
              <label>
                Observações
                <textarea name="notes" defaultValue={editing.notes || ""} />
              </label>
            )}
            <div className="movement-editor-actions">
              <button
                type="button"
                className="danger-text"
                disabled={saving}
                onClick={remove}
              >
                Excluir
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button className="primary" disabled={saving}>
                {saving ? "Salvando…" : "Salvar alterações"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
