"use client";

import { useState } from "react";
import { type Payment, formatCurrency, formatName } from "@/lib/types";
import { doc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface PaymentTableProps { payments: Payment[]; isMonthClosed: boolean; onPaymentChanged: () => void }

export default function PaymentTable({ payments, isMonthClosed, onPaymentChanged }: PaymentTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function changePayment(payment: Payment, remove = false) {
    if (busy || isMonthClosed || !payment.id) return;
    const amount = Number(editAmount.replace(",", "."));
    if (!remove && (!Number.isFinite(amount) || amount <= 0)) { setError("Unesite iznos veći od nule."); return; }
    if (remove && !confirm(`Obrisati uplatu ${formatCurrency(payment.amount)} za ${formatName(payment.resellerName)}?`)) return;
    setBusy(true); setError("");
    try {
      await runTransaction(db, async transaction => {
        const ref = doc(db, "payments", payment.id!);
        const current = await transaction.get(ref);
        if (!current.exists()) throw new Error("Uplata više ne postoji. Osvježite pregled.");
        if (current.data().amount !== payment.amount || current.data().monthYear !== payment.monthYear) throw new Error("Uplata je u međuvremenu promijenjena. Osvježite pregled.");
        const status = await transaction.get(doc(db, "monthStatus", current.data().monthYear));
        if (status.data()?.isClosed) throw new Error("Mjesec je zaključen. Uplata nije promijenjena.");
        if (remove) transaction.delete(ref); else transaction.update(ref, { amount });
      });
      setEditingId(null); onPaymentChanged();
    } catch (cause) { setError(cause instanceof Error && !cause.message.includes("Firebase") ? cause.message : "Promjena nije spremljena. Pokušajte ponovno."); }
    finally { setBusy(false); }
  }
  return <div className="surface payment-list">
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <div className="table-scroll"><table className="payment-table"><thead><tr><th>Datum</th><th>Reseller</th><th className="amount-cell">Iznos</th><th className="action-cell">Radnje</th></tr></thead><tbody>
      {!payments.length ? <tr><td colSpan={4} className="empty-state">Nema uplata za ovaj pregled.</td></tr> : payments.map(payment => <tr key={payment.id}>
        <td className="date-cell">{Number.isNaN(new Date(payment.date).getTime()) ? payment.date : new Date(payment.date).toLocaleDateString("hr-HR", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
        <td className="payment-name">{formatName(payment.resellerName)}</td>
        <td className="amount-cell">{editingId === payment.id ? <input aria-label={`Novi iznos uplate za ${formatName(payment.resellerName)}`} className="amount-input" inputMode="decimal" value={editAmount} onChange={event => setEditAmount(event.target.value)} autoFocus disabled={busy}/> : formatCurrency(payment.amount)}</td>
        <td className="action-cell">{editingId === payment.id ? <div className="table-actions"><button className="button button-primary" disabled={busy || isMonthClosed} onClick={() => changePayment(payment)}>{busy ? "Spremanje…" : "Spremi"}</button><button className="button" disabled={busy} onClick={() => { setEditingId(null); setError(""); }}>Odustani</button></div> : <div className="table-actions"><button className="button button-quiet" disabled={busy || isMonthClosed} onClick={() => { setEditingId(payment.id!); setEditAmount(String(payment.amount)); setError(""); }}>Uredi</button><button className="button button-quiet button-danger" disabled={busy || isMonthClosed} onClick={() => changePayment(payment, true)}>Obriši</button></div>}</td>
      </tr>)}
    </tbody></table></div>
  </div>;
}
