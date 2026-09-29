"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { resellerNameVariants } from "@/lib/reseller-names";
import { db } from "@/lib/firebase";
import { type Reseller, type Payment, type CreditTransaction, formatCurrency } from "@/lib/types";

export default function ResellerDetails({ reseller }: { reseller: Reseller }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [paid, credits] = await Promise.all([
          getDocs(query(collection(db, "payments"), where("resellerName", "in", resellerNameVariants(reseller.name)))),
          getDocs(query(collection(db, "credit_transactions"), where("resellerName", "in", resellerNameVariants(reseller.name)))),
        ]);
        if (!active) return;
        setPayments(paid.docs.map(item => ({ ...item.data(), id: item.id } as Payment)).sort((a, b) => b.monthYear.localeCompare(a.monthYear) || b.date.localeCompare(a.date)));
        setBalance(credits.docs.reduce((sum, item) => { const tx = item.data() as CreditTransaction; return sum + (tx.type === "allocation" ? tx.amount : -tx.amount); }, 0));
      } catch { if (active) setError("Uplate i krediti nisu učitani. Zatvorite detalje i pokušajte ponovno."); }
      finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [reseller.name]);
  return <div className="page-stack">
    <dl className="contact-details"><div><dt>E-mail</dt><dd>{reseller.email || "Nije upisan"}</dd></div><div><dt>Telefon</dt><dd>{reseller.phone || "Nije upisan"}</dd></div>{reseller.notes && <div><dt>Bilješke</dt><dd className="preserve-lines">{reseller.notes}</dd></div>}</dl>
    <Link className="button" href={`/dashboard/resellers/${reseller.id}`}>Otvori profil i uredi podatke</Link>
    {loading ? <p role="status" className="muted">Učitavanje uplata i kredita…</p> : error ? <p className="notice notice-error" role="alert">{error}</p> : <>
      <div className="panel-stats"><div className="summary-card"><span>Ukupno uplaćeno</span><strong>{formatCurrency(payments.reduce((sum, item) => sum + item.amount, 0))}</strong></div><div className="summary-card"><span>{balance !== null && balance < 0 ? "Preplata kredita" : "Preostali dug"}</span><strong>{formatCurrency(Math.abs(balance || 0))}</strong></div></div>
      <div><h3>Uplate <span className="muted">({payments.length})</span></h3><p className="field-hint">Prikaz zadnjih 10 uplata. Cijela povijest dostupna je u profilu.</p></div>
      {payments.length ? <ul className="recent-payments">{payments.slice(0, 10).map(item => <li key={item.id}><span>{Number.isNaN(new Date(item.date).getTime()) ? item.date : new Date(item.date).toLocaleDateString("hr-HR")}<small>Obračun: {item.monthYear}</small></span><strong>{formatCurrency(item.amount)}</strong></li>)}</ul> : <p className="muted">Nema evidentiranih uplata.</p>}
    </>}
  </div>;
}
