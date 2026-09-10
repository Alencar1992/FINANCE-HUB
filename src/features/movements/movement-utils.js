export function formatMovementDate(value) {
  return value
    ? new Date(`${value}T12:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      })
    : "Sem data";
}

export function mapLinkedMovements(obligations = [], purchases = [], charges = []) {
  return [
    ...obligations.map((item) => ({
      id: `o-${item.id}`,
      sourceId: item.id,
      sourceType: "obligation",
      sourceLabel: item.direction === "receivable" ? "Me devem" : "Eu devo",
      name: `${item.counterparty_name} · ${item.description}`,
      cat:
        item.category ||
        (item.direction === "receivable" ? "Me devem" : "Eu devo"),
      value: Number(item.installment_amount || item.remaining_amount),
      date: formatMovementDate(item.next_due_date),
      type: item.direction === "receivable" ? "in" : "out",
      status:
        item.status === "paid"
          ? "Quitado"
          : item.status === "overdue"
            ? "Vencido"
            : `Parcela ${Math.min(
                (item.paid_installments || 0) + 1,
                item.installments || 1,
              )}/${item.installments || 1}`,
    })),
    ...purchases.map((item) => ({
      id: `p-${item.id}`,
      sourceId: item.id,
      sourceType: "card_purchase",
      sourceLabel: "Cartão de crédito",
      name: `${item.cards?.name || "Cartão"} · ${item.description}`,
      cat: `Cartão · ${item.purchased_by}`,
      value: Number(item.installment_amount),
      date: formatMovementDate(item.first_due_date),
      type: "out",
      status:
        item.status === "paid"
          ? "Pago"
          : item.status === "cancelled"
            ? "Cancelado"
            : `Parcela ${Math.min(
                (item.paid_installments || 0) + 1,
                item.installment_count,
              )}/${item.installment_count}`,
    })),
    ...charges.map((item) => ({
      id: `s-${item.id}`,
      sourceId: item.id,
      sourceType: "subscription_charge",
      sourceLabel: "Streaming",
      name: `${item.subscriptions?.name || "Streaming"} · ${item.participant_name}`,
      cat: "Streaming compartilhado",
      value: Number(item.amount),
      date: formatMovementDate(item.due_date),
      type: "in",
      status:
        item.status === "paid"
          ? "Recebido"
          : item.status === "overdue"
            ? "Vencido"
            : item.status === "cancelled"
              ? "Cancelado"
              : "Pendente",
    })),
  ];
}

export function movementValue(sourceType, movement) {
  if (sourceType === "transaction") {
    return Number(movement.total_amount || movement.amount);
  }
  if (sourceType === "subscription_charge") return Number(movement.amount);
  return Number(movement.total_amount);
}

export function buildMovementPayload(sourceType, form, value, movement) {
  if (sourceType === "transaction") {
    const recurring = form.get("recurring") === "on";
    return {
      name: String(form.get("name") || "").trim(),
      category: String(form.get("category") || "Outros").trim(),
      total_amount: value,
      installment_count: Math.max(
        1,
        Number(form.get("installments") || movement.installment_count || 1),
      ),
      transaction_type: form.get("direction"),
      transaction_date: form.get("date"),
      status: form.get("status"),
      is_recurring: recurring,
      recurrence_day: recurring ? Number(form.get("recurrence_day")) : null,
      notes: form.get("notes") || null,
    };
  }

  if (sourceType === "obligation") {
    return {
      direction: form.get("direction"),
      counterparty_name: String(form.get("counterparty") || "").trim(),
      phone: String(form.get("phone") || "").replace(/\D/g, "") || null,
      description: String(form.get("description") || "").trim(),
      category: String(form.get("category") || "Outros").trim(),
      total_amount: value,
      installments: Math.max(1, Number(form.get("installments") || 1)),
      next_due_date: form.get("date") || null,
      status: form.get("status"),
      notes: form.get("notes") || null,
    };
  }

  if (sourceType === "card_purchase") {
    return {
      description: String(form.get("description") || "").trim(),
      purchased_by: String(form.get("counterparty") || "Próprio").trim(),
      total_amount: value,
      installment_count: Math.max(1, Number(form.get("installments") || 1)),
      first_due_date: form.get("date"),
      status: form.get("status"),
    };
  }

  return {
    participant_name: String(form.get("counterparty") || "").trim(),
    phone: String(form.get("phone") || "").replace(/\D/g, "") || null,
    amount: value,
    due_date: form.get("date"),
    status: form.get("status"),
  };
}
