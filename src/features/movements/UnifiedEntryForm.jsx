import { useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { money, parseBRNumber } from "../../lib/finance";
import { createFinancialEntry } from "./financial-entry-service";
import {
  buildFinancialEntryPayload,
  entryStatusOptions,
  FINANCIAL_ENTRY_TYPES,
} from "./financial-entry-utils";

function requestId() {
  return globalThis.crypto?.randomUUID?.() ||
    `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function UnifiedEntryForm({ owner, close, notify, onCreated }) {
  const [entryType, setEntryType] = useState("expense");
  const [total, setTotal] = useState("");
  const [installments, setInstallments] = useState(1);
  const [parcelled, setParcelled] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [saving, setSaving] = useState(false);
  const requestIdRef = useRef(requestId());
  const isTransaction = entryType === "income" || entryType === "expense";
  const installmentCount = parcelled ? Number(installments) : 1;
  const installmentValue = (parseBRNumber(total) || 0) / installmentCount;
  const statuses = entryStatusOptions(entryType);

  function changeType(nextType) {
    setEntryType(nextType);
    setRecurring(false);
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    let payload;
    try {
      payload = buildFinancialEntryPayload(entryType, {
        description: form.get("description"),
        category: form.get("category"),
        total,
        installments: installmentCount,
        date: form.get("date"),
        status: form.get("status"),
        notes: form.get("notes"),
        recurring,
        recurrenceDay: form.get("recurrence_day"),
        counterparty: form.get("counterparty"),
        phone: form.get("phone"),
      });
    } catch (error) {
      notify(error.message);
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await createFinancialEntry(
        owner.id,
        requestIdRef.current,
        entryType,
        payload,
      );
      if (error) {
        notify("Não foi possível salvar o lançamento. Tente novamente.");
        return;
      }
      await onCreated(data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-bg" onMouseDown={() => !saving && close()}>
      <div className="modal unified-entry-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Novo lançamento</h2>
            <p>Cadastre receitas, despesas e compromissos em um único formulário.</p>
          </div>
          <button onClick={close} disabled={saving} aria-label="Fechar lançamento">
            <X />
          </button>
        </div>
        <form className="form unified-entry-form" onSubmit={submit}>
          <fieldset className="entry-type-fieldset">
            <legend>Tipo do lançamento</legend>
            <div className="entry-type-grid">
              {FINANCIAL_ENTRY_TYPES.map((option) => (
                <label
                  className={entryType === option.id ? "entry-type selected" : "entry-type"}
                  key={option.id}
                >
                  <input
                    type="radio"
                    name="entry_type"
                    value={option.id}
                    checked={entryType === option.id}
                    onChange={() => changeType(option.id)}
                  />
                  <span><Check /></span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </label>
              ))}
            </div>
          </fieldset>

          {!isTransaction && (
            <div className="fields">
              <label>
                Pessoa ou empresa
                <input name="counterparty" required placeholder="Nome do contato" />
              </label>
              <label>
                WhatsApp
                <input name="phone" inputMode="tel" placeholder="5511999999999" />
              </label>
            </div>
          )}

          <label>
            Descrição
            <input name="description" required placeholder="Ex.: Salário, mercado ou empréstimo" />
          </label>
          <div className="fields">
            <label>
              Categoria
              <input name="category" placeholder="Automática ou digite" />
            </label>
            <label>
              Valor total
              <input
                value={total}
                onChange={(event) => setTotal(event.target.value)}
                inputMode="decimal"
                placeholder="1.234,56"
                required
              />
            </label>
          </div>
          <div className="fields">
            <label>
              {isTransaction ? "Data" : "Primeiro vencimento"}
              <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </label>
            <label>
              Status
              <select name="status" defaultValue={statuses[0][0]} key={entryType}>
                {statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
          </div>

          <label className="installment-toggle">
            <input
              type="checkbox"
              checked={parcelled}
              disabled={recurring}
              onChange={(event) => setParcelled(event.target.checked)}
            />
            Parcelar este valor
          </label>
          {isTransaction && (
            <label className="installment-toggle recurring-toggle">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(event) => {
                  setRecurring(event.target.checked);
                  if (event.target.checked) setParcelled(false);
                }}
              />
              Repetir mensalmente até quitação ou cancelamento
            </label>
          )}
          {recurring && (
            <label>
              Dia mensal do vencimento
              <input name="recurrence_day" type="number" min="1" max="31" defaultValue={new Date().getDate()} />
            </label>
          )}
          {parcelled && (
            <div className="installment-box">
              <label>
                Quantidade de parcelas
                <input
                  type="number"
                  min="2"
                  max="120"
                  value={installments}
                  onChange={(event) => setInstallments(event.target.value)}
                />
              </label>
              <div>
                <span>Valor mensal</span>
                <strong>{money(installmentValue)}</strong>
                <small>Parcela 1/{installmentCount} será a atual.</small>
              </div>
            </div>
          )}

          <label>
            Observações
            <textarea name="notes" placeholder="Opcional" />
          </label>
          <div className="form-actions">
            <button type="button" onClick={close} disabled={saving}>Cancelar</button>
            <button className="primary" disabled={saving}>
              {saving ? "Salvando…" : "Salvar lançamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
