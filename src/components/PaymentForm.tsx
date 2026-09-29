"use client";

import { useState, useEffect } from "react";
import { collection, doc, getDocs, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatName } from "@/lib/types";
import { defaultPaymentDate, validateNewPayment } from "@/lib/payment-validation";
import { format, endOfMonth } from "date-fns";
import { hr } from "date-fns/locale/hr";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface PaymentFormProps { onPaymentAdded: () => void; selectedMonth: string; isMonthClosed: boolean; onBusyChange?: (busy: boolean) => void }

export default function PaymentForm({ onPaymentAdded, selectedMonth, isMonthClosed, onBusyChange }: PaymentFormProps) {
  const [resellers, setResellers] = useState<string[]>([]);
  const [resellerName, setResellerName] = useState("");
  const [isNewReseller, setIsNewReseller] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date | null>(() => defaultPaymentDate(selectedMonth));
  const [loading, setLoading] = useState(false);
  const [loadingResellers, setLoadingResellers] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    getDocs(collection(db, "resellers")).then(snapshot => {
      if (active) setResellers(snapshot.docs.map(item => item.data().name as string).sort((a, b) => a.localeCompare(b, "hr")));
    }).catch(() => { if (active) { setError("Popis resellera nije učitan. Zatvorite obrazac i pokušajte ponovno."); setLoadError(true); } }).finally(() => { if (active) setLoadingResellers(false); });
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading || loadingResellers || loadError) return;
    const numericAmount = Number(amount.replace(",", "."));
    const validation = validateNewPayment(resellerName, numericAmount, date, selectedMonth);
    if (validation) { setError(validation); return; }
    if (isMonthClosed) { setError("Mjesec je zaključen. Nove uplate nisu dopuštene."); return; }
    setLoading(true);
    onBusyChange?.(true);
    setError("");
    try {
      // Keep the exact existing name: old payments and credit balances use it as their link.
      const name = isNewReseller ? formatName(resellerName.trim()) : resellerName;
      const existing = isNewReseller ? await getDocs(collection(db, "resellers")) : null;
      const matchingName = existing?.docs.find(item => item.data().name.trim().toLocaleLowerCase("hr") === name.toLocaleLowerCase("hr"))?.data().name as string | undefined;
      const paymentRef = doc(collection(db, "payments"));
      const resellerRef = doc(collection(db, "resellers"));
      await runTransaction(db, async transaction => {
        const status = await transaction.get(doc(db, "monthStatus", selectedMonth));
        if (status.data()?.isClosed) throw new Error("Mjesec je u međuvremenu zaključen. Uplata nije spremljena.");
        const createdAt = new Date().toISOString();
        if (isNewReseller && !matchingName) transaction.set(resellerRef, { name, email: "", phone: "", notes: "", createdAt });
        transaction.set(paymentRef, { resellerName: matchingName || name, amount: numericAmount, currency: "EUR", date: date!.toISOString(), monthYear: selectedMonth, createdAt });
      });
      onPaymentAdded();
    } catch (cause) {
      setError(cause instanceof Error && cause.message.includes("zaključen") ? cause.message : "Uplata nije spremljena. Provjerite vezu i pokušajte ponovno.");
    } finally { setLoading(false); onBusyChange?.(false); }
  }
  const monthStart = new Date(`${selectedMonth}-01T00:00:00`);
  return <form onSubmit={handleSubmit} className="stack-form">
    <p className="muted">Uplata za {format(monthStart, "MMMM yyyy.", { locale: hr })}</p>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <fieldset disabled={loading || loadingResellers || loadError || isMonthClosed} className="form-fields">
      <label htmlFor="payment-reseller">Reseller</label>
      {!isNewReseller ? <select id="payment-reseller" value={resellerName} required onChange={event => { if (event.target.value === "__new__") { setIsNewReseller(true); setResellerName(""); } else setResellerName(event.target.value); }}>
        <option value="" disabled>{loadingResellers ? "Učitavanje…" : "Odaberite resellera"}</option>
        {resellers.map((name, index) => <option key={`${name}-${index}`} value={name}>{name}</option>)}
        <option value="__new__">+ Novi reseller</option>
      </select> : <><input id="payment-reseller" value={resellerName} onChange={event => setResellerName(event.target.value)} placeholder="Ime novog resellera" required autoFocus/><button className="text-button" type="button" onClick={() => { setIsNewReseller(false); setResellerName(""); }}>Odaberi postojećeg resellera</button><p className="field-hint">Novi profil i uplata spremaju se zajedno.</p></>}
      <label htmlFor="payment-amount">Iznos (€)</label><input id="payment-amount" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0,00" required/>
      <label htmlFor="payment-date">Datum uplate</label>
      <DatePicker id="payment-date" selected={date} onChange={(value: Date | null) => setDate(value)} minDate={monthStart} maxDate={endOfMonth(monthStart)} dateFormat="dd.MM.yyyy." locale={hr} required/>
      <p className="field-hint">Datum mora pripadati odabranom mjesecu. Za drugi mjesec prvo promijenite razdoblje na popisu uplata.</p>
      <button type="submit" className="button button-primary">{loading ? "Spremanje…" : "Spremi uplatu"}</button>
    </fieldset>
  </form>;
}
