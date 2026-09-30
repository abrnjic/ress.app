"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, onSnapshot, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CreditTransaction, Reseller, formatCurrency } from "@/lib/types";
import { FiPlus, FiArrowDownLeft, FiTrash2, FiSearch, FiEdit3 } from "react-icons/fi";
import SidePanel from "@/components/SidePanel";
import { hr } from "date-fns/locale/hr";
import { format } from "date-fns";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function CreditsPage() {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [typeFilter, setTypeFilter] = useState("all");
  const [resellerFilter, setResellerFilter] = useState("");
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [resellersLoading, setResellersLoading] = useState(true);
  const [resellerError, setResellerError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'allocation' | 'repayment'>('allocation');
  
  // Form states
  const [selectedReseller, setSelectedReseller] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");
  const [payerName, setPayerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch resellers
    const fetchResellers = async () => {
      try {
        const q = query(collection(db, "resellers"), orderBy("name"));
        const snapshot = await getDocs(q);
        const resData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reseller));
        setResellers(resData);
      } catch { setResellerError("Popis resellera nije učitan. Osvježite stranicu i pokušajte ponovno."); }
      finally { setResellersLoading(false); }
    };
    fetchResellers();

    // Listen to credit transactions
    const qTx = query(collection(db, "credit_transactions"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(qTx, (snapshot) => {
      const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreditTransaction));
      setTransactions(txData);
      setLoading(false);
      setLoadError("");
    }, () => { setLoadError("Krediti nisu učitani. Provjerite vezu i osvježite stranicu."); setLoading(false); });

    return () => unsubscribe();
  }, []);

  const openModal = (type: 'allocation' | 'repayment', tx?: CreditTransaction, resellerName = '') => {
    setFormError('');
    setModalType(type);
    if (tx) {
      setEditingTxId(tx.id!);
      setSelectedReseller(tx.resellerName);
      setAmount(tx.amount.toString());
      setNotes(tx.notes || "");
      setPayerName(tx.payerName || "");
      setDate(new Date(tx.date));
    } else {
      setEditingTxId(null);
      setSelectedReseller(resellerName);
      setAmount("");
      setNotes("");
      setPayerName("");
      setDate(new Date());
    }
    setIsModalOpen(true);
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const numericAmount = Number(amount.replace(",", "."));
    if (!selectedReseller || !amount.trim() || !Number.isFinite(numericAmount) || numericAmount < 0 || !Number.isFinite(date.getTime())) { setFormError("Provjerite resellera, iznos i datum."); return; }
    setFormError("");

    setIsSubmitting(true);
    try {
      const tx = {
        resellerName: selectedReseller,
        type: modalType,
        amount: numericAmount,
        date: date.toISOString()
      };

      if (editingTxId) {
        await updateDoc(doc(db, "credit_transactions", editingTxId), {
          ...tx,
          notes: notes || deleteField(),
          payerName: payerName.trim() || deleteField(),
        });
      } else {
        await addDoc(collection(db, "credit_transactions"), {
          ...tx,
          ...(notes ? { notes } : {}),
          ...(payerName.trim() ? { payerName: payerName.trim() } : {}),
          createdAt: new Date().toISOString(),
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error adding transaction:", error);
      setFormError("Transakcija nije spremljena. Provjerite vezu i pokušajte ponovno.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (tx: CreditTransaction) => {
    if (deletingId || !tx.id) return;
    if (!confirm(`Obrisati ${tx.type === 'allocation' ? 'kredit' : 'otplatu'} od ${formatCurrency(tx.amount)} za ${tx.resellerName}?`)) return;
    setDeletingId(tx.id);
    setActionError("");
    try { await deleteDoc(doc(db, "credit_transactions", tx.id)); }
    catch { setActionError("Transakcija nije obrisana. Pokušajte ponovno."); }
    finally { setDeletingId(null); }
  };

  // Calculations
  let totalAllocated = 0;
  let totalRepaid = 0;
  
  const balancesByReseller: Record<string, { allocated: number; repaid: number; debt: number }> = {};

  transactions.forEach(tx => {
    if (tx.type === 'allocation') totalAllocated += tx.amount;
    if (tx.type === 'repayment') totalRepaid += tx.amount;

    if (!balancesByReseller[tx.resellerName]) {
      balancesByReseller[tx.resellerName] = { allocated: 0, repaid: 0, debt: 0 };
    }
    
    if (tx.type === 'allocation') balancesByReseller[tx.resellerName].allocated += tx.amount;
    if (tx.type === 'repayment') balancesByReseller[tx.resellerName].repaid += tx.amount;
  });

  const totalOutstanding = totalAllocated - totalRepaid;

  // Final balances array sorted by debt descending
  const balanceArray = Object.keys(balancesByReseller).map(name => ({
    name,
    ...balancesByReseller[name],
    debt: balancesByReseller[name].allocated - balancesByReseller[name].repaid
  }))
  .filter(b => b.allocated > 0 || b.repaid > 0)
  .sort((a, b) => b.debt - a.debt);

  const normalize = (value: string) => value.toLocaleLowerCase("hr").replace(/đ/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const displayDate = (value: string) => Number.isNaN(new Date(value).getTime()) ? value : format(new Date(value), "dd.MM.yyyy");
  const filteredTransactions = transactions.filter(tx => {
    if (typeFilter !== "all" && tx.type !== typeFilter) return false;
    if (resellerFilter && tx.resellerName !== resellerFilter) return false;
    const searchable = `${tx.resellerName} ${tx.payerName || ""} ${tx.notes || ""} ${tx.amount} ${formatCurrency(tx.amount)} ${displayDate(tx.date)}`;
    return normalize(searchable).includes(normalize(searchQuery.trim()));
  });
  const filterNames = [...new Set(transactions.map(tx => tx.resellerName))].sort((a, b) => a.localeCompare(b, "hr"));
  const formNames = [...new Set([...resellers.map(reseller => reseller.name), ...(selectedReseller ? [selectedReseller] : [])])].sort((a, b) => a.localeCompare(b, "hr"));
  const hasFilters = !!searchQuery || typeFilter !== "all" || !!resellerFilter;
  const panelTitle = editingTxId
    ? (modalType === "allocation" ? "Uredi kredit" : "Uredi otplatu")
    : (modalType === "allocation" ? "Novi kredit" : "Upiši otplatu");

  return (
    <section className="page-stack credits-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Krediti i otplate</p>
          <h1>Krediti</h1>
          <p className="muted">Jasan pregled zaduženja, otplata i preostalog duga.</p>
        </div>
        <div className="toolbar-actions credit-main-actions">
          <button className="button" disabled={loading || !!loadError} onClick={() => openModal("allocation")}><FiPlus/> Novi kredit</button>
          <button className="button button-primary" disabled={loading || !!loadError} onClick={() => openModal("repayment")}><FiArrowDownLeft/> Upiši otplatu</button>
        </div>
      </div>

      {(loadError || actionError) && <p className="notice notice-error" role="alert">{loadError || actionError}</p>}
      <div className="summary-grid credit-summary" aria-label="Ukupno stanje kredita">
        <div className="summary-card credit-outstanding"><span>{totalOutstanding < 0 ? "Ukupna preplata" : "Preostali dug"}</span><strong>{loading || loadError ? "—" : formatCurrency(Math.abs(totalOutstanding))}</strong><small>Izdani krediti umanjeni za otplate</small></div>
        <div className="summary-card"><span>Ukupno izdano</span><strong>{loading || loadError ? "—" : formatCurrency(totalAllocated)}</strong><small>Svi evidentirani krediti</small></div>
        <div className="summary-card"><span>Ukupno otplaćeno</span><strong>{loading || loadError ? "—" : formatCurrency(totalRepaid)}</strong><small>Sve evidentirane otplate</small></div>
      </div>

      {loading ? <p className="empty-state" role="status">Učitavanje kredita…</p> : !loadError && <>
        <section className="surface credit-balances" aria-labelledby="balances-title">
          <div className="credit-section-heading"><div><h2 id="balances-title">Stanje po resellerima</h2><p className="field-hint">Najveći dugovi prikazani su prvi.</p></div><span className="status-badge">{balanceArray.length} resellera</span></div>
          <div className="table-scroll">
            <table className="payment-table credit-balance-table" aria-label="Stanje po resellerima">
              <thead><tr><th>Reseller</th><th className="amount-cell">Izdano</th><th className="amount-cell">Otplaćeno</th><th className="amount-cell">Preostali dug</th><th className="action-cell">Radnje</th></tr></thead>
              <tbody>{balanceArray.map(balance => <tr key={balance.name}>
                <td className="payment-name">{balance.name}</td>
                <td className="amount-cell" data-label="Izdano">{formatCurrency(balance.allocated)}</td>
                <td className="amount-cell" data-label="Otplaćeno">{formatCurrency(balance.repaid)}</td>
                <td className="amount-cell credit-balance-amount" data-label={balance.debt < 0 ? "Preplata" : "Dug"}><strong>{formatCurrency(Math.abs(balance.debt))}</strong>{balance.debt <= 0 && <small>{balance.debt < 0 ? "Preplata" : "Podmireno"}</small>}</td>
                <td className="action-cell"><div className="table-actions"><button className="button button-quiet" onClick={() => { setResellerFilter(balance.name); setSearchQuery(""); setTypeFilter("all"); document.getElementById("credit-history-title")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Povijest</button><button className="button" onClick={() => openModal("repayment", undefined, balance.name)}>Upiši otplatu</button></div></td>
              </tr>)}{!balanceArray.length && <tr><td colSpan={5} className="empty-state">Još nema evidentiranih kredita ili otplata.</td></tr>}</tbody>
            </table>
          </div>
        </section>

        <section className="page-stack credit-history" aria-labelledby="credit-history-title">
          <div className="credit-section-heading credit-history-heading"><div><h2 id="credit-history-title">Povijest transakcija</h2><p className="field-hint">Najnovije transakcije na vrhu.</p></div><span className="muted" role="status">{filteredTransactions.length} od {transactions.length} transakcija</span></div>
          <div className="credit-filters">
            <div className="search-field"><FiSearch/><input aria-label="Pretraži transakcije" placeholder="Reseller, uplatitelj, iznos ili bilješka…" value={searchQuery} onChange={event => setSearchQuery(event.target.value)}/></div>
            <div className="credit-filter-controls">
              <div className="credit-type-filter" role="group" aria-label="Vrsta transakcije">
                {([{ value: "all", label: "Sve" }, { value: "allocation", label: "Krediti" }, { value: "repayment", label: "Otplate" }]).map(filter => <button key={filter.value} aria-pressed={typeFilter === filter.value} onClick={() => setTypeFilter(filter.value)}>{filter.label}</button>)}
              </div>
              <select aria-label="Filtriraj po reselleru" value={resellerFilter} onChange={event => setResellerFilter(event.target.value)}><option value="">Svi reselleri</option>{filterNames.map(name => <option key={name} value={name}>{name}</option>)}</select>
              {hasFilters && <button className="text-button" onClick={() => { setSearchQuery(""); setTypeFilter("all"); setResellerFilter(""); }}>Očisti filtre</button>}
            </div>
          </div>
          <div className="surface table-scroll">
            <table className="payment-table credit-history-table" aria-label="Povijest transakcija">
              <thead><tr><th>Datum</th><th>Reseller / uplatitelj</th><th>Vrsta</th><th className="amount-cell">Iznos</th><th className="action-cell">Radnje</th></tr></thead>
              <tbody>{filteredTransactions.map(tx => <tr key={tx.id}>
                <td className="date-cell">{displayDate(tx.date)}</td>
                <td className="credit-transaction-name"><strong>{tx.resellerName}</strong>{(tx.payerName || tx.notes) && <div className="credit-transaction-note">{tx.payerName && <span>Uplatio: {tx.payerName}</span>}{tx.payerName && tx.notes && <span aria-hidden="true"> · </span>}{tx.notes && <span>{tx.notes}</span>}</div>}</td>
                <td className="credit-type-cell"><span className={`credit-type-badge ${tx.type}`}>{tx.type === "allocation" ? "Kredit" : "Otplata"}</span></td>
                <td className="amount-cell credit-transaction-amount">{tx.type === "allocation" ? "+" : "−"}{formatCurrency(tx.amount)}</td>
                <td className="action-cell"><div className="table-actions"><button className="button button-quiet" aria-label={`Uredi ${tx.type === "allocation" ? "kredit" : "otplatu"} ${displayDate(tx.date)} ${formatCurrency(tx.amount)}`} onClick={() => openModal(tx.type, tx)} disabled={!!deletingId}><FiEdit3/><span>Uredi</span></button><button className="button button-quiet button-danger" title="Obriši transakciju" aria-label={`Obriši transakciju ${displayDate(tx.date)} ${formatCurrency(tx.amount)}`} onClick={() => handleDelete(tx)} disabled={!!deletingId}><FiTrash2/></button></div></td>
              </tr>)}{!filteredTransactions.length && <tr><td colSpan={5} className="empty-state">{transactions.length ? "Nema transakcija za odabrane filtre." : "Još nema transakcija. Dodajte kredit ili evidentirajte otplatu."}</td></tr>}</tbody>
            </table>
          </div>
        </section>
      </>}

      {isModalOpen && <SidePanel title={panelTitle} onClose={() => { if (!isSubmitting) setIsModalOpen(false); }}>
        <form onSubmit={handleAddTransaction} className="stack-form">
          <p className="muted">{modalType === "allocation" ? "Kredit povećava zaduženje odabranog resellera." : "Otplata umanjuje zaduženje odabranog resellera."}</p>
          {(formError || resellerError) && <p className="notice notice-error" role="alert">{formError || resellerError}</p>}
          <fieldset className="form-fields" disabled={isSubmitting || resellersLoading || !!resellerError}>
            <label htmlFor="credit-reseller">Reseller</label>
            <select id="credit-reseller" value={selectedReseller} onChange={event => setSelectedReseller(event.target.value)} required><option value="">{resellersLoading ? "Učitavanje…" : "Odaberite resellera"}</option>{formNames.map(name => <option key={name} value={name}>{name}</option>)}</select>
            {modalType === "repayment" && <><label htmlFor="credit-payer">Uplatitelj / subseller <span className="muted">(neobavezno)</span></label><input id="credit-payer" placeholder="Ime uplatitelja" value={payerName} onChange={event => setPayerName(event.target.value)}/></>}
            <label htmlFor="credit-amount">Iznos (€)</label><input id="credit-amount" type="number" step="0.01" min="0" placeholder="0,00" value={amount} onChange={event => setAmount(event.target.value)} required/>
            <label htmlFor="credit-date">Datum</label><DatePicker id="credit-date" selected={date} onChange={(value: Date | null) => value && setDate(value)} dateFormat="dd.MM.yyyy." locale={hr} required/>
            <label htmlFor="credit-notes">Bilješka <span className="muted">(neobavezno)</span></label><textarea id="credit-notes" rows={3} placeholder="Dodajte kratku napomenu" value={notes} onChange={event => setNotes(event.target.value)}/>
            <button type="submit" className="button button-primary">{isSubmitting ? "Spremanje…" : editingTxId ? "Spremi promjene" : modalType === "allocation" ? "Spremi kredit" : "Spremi otplatu"}</button>
            <button type="button" className="button button-quiet" onClick={() => setIsModalOpen(false)}>Odustani</button>
          </fieldset>
        </form>
      </SidePanel>}
    </section>
  );
}
