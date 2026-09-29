"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { collection, query, where, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Payment, MonthStatus, formatCurrency } from "@/lib/types";
import { format, subMonths, addMonths } from "date-fns";
import { hr } from "date-fns/locale/hr";

function parseCustomDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  if (dateStr.includes('.')) {
    const parts = dateStr.split('.');
    if (parts.length >= 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const customD = new Date(year, month, day);
      if (!isNaN(customD.getTime())) return customD;
    }
  }
  return new Date();
}
import PaymentForm from "@/components/PaymentForm";
import PaymentTable from "@/components/PaymentTable";
import { FiDownload, FiFileText, FiPlus, FiChevronLeft, FiChevronRight, FiSearch } from "react-icons/fi";
import SidePanel from "@/components/SidePanel";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function DashboardPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [monthStatus, setMonthStatus] = useState<MonthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [yearlyTotal, setYearlyTotal] = useState(0);

  const [paymentSaving, setPaymentSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const requestId = useRef(0);

  // Global search state
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<Payment[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const selectedMonthStr = format(currentDate, "yyyy-MM");
  const displayMonthStr = format(currentDate, "MMMM yyyy", { locale: hr }).replace(/^\w/, c => c.toUpperCase());
  const currentYear = format(currentDate, "yyyy");

  const fetchData = useCallback(async () => {
    const request = ++requestId.current;
    setError("");
    setMonthStatus(null);
    
    setLoading(true);
    try {
      const statusRef = doc(db, "monthStatus", selectedMonthStr);
      const statusSnap = await getDoc(statusRef);
      if (request !== requestId.current) return;
      if (statusSnap.exists()) {
        setMonthStatus(statusSnap.data() as MonthStatus);
      } else {
        setMonthStatus({ id: selectedMonthStr, isClosed: false });
      }

      const q = query(collection(db, "payments"), where("monthYear", "==", selectedMonthStr));
      const snapshot = await getDocs(q);
      const fetchedPayments: Payment[] = [];
      snapshot.forEach(doc => {
        fetchedPayments.push({ id: doc.id, ...doc.data() } as Payment);
      });
      
      const getDayForSort = (dateStr: string) => {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d.getDate();
        const match = dateStr.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };

      fetchedPayments.sort((a, b) =>
        getDayForSort(b.date) - getDayForSort(a.date) ||
        (b.createdAt || "").localeCompare(a.createdAt || "")
      );
      if (request !== requestId.current) return;
      setPayments(fetchedPayments);

      const yQ = query(
        collection(db, "payments"),
        where("monthYear", ">=", `${currentYear}-01`),
        where("monthYear", "<=", `${currentYear}-12`)
      );
      const ySnapshot = await getDocs(yQ);
      let yTotal = 0;
      ySnapshot.forEach(doc => {
        yTotal += doc.data().amount || 0;
      });
      if (request !== requestId.current) return;
      setYearlyTotal(yTotal);

    } catch (error) {
      console.error("Error fetching data:", error);
      if (request === requestId.current) setError("Podaci nisu učitani. Pokušajte ponovno.");
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [selectedMonthStr, currentYear]);

  useEffect(() => {
    // This effect synchronizes the selected month with Firestore.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    return () => { requestId.current += 1; };
  }, [fetchData]);

  // Global Search Effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }
    
    let cancelled = false;
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const snapshot = await getDocs(collection(db, "payments"));
        const results: Payment[] = [];
        const normalizeStr = (str: string) => 
          str ? str.replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
        
        const normalizedQuery = normalizeStr(searchQuery);
        
        snapshot.forEach(doc => {
          const data = doc.data() as Payment;
          const matchReseller = normalizeStr(data.resellerName).includes(normalizedQuery);
          
          // Match both raw number ("300") and formatted string ("300,00")
          const rawAmount = data.amount.toString();
          const formattedAmount = data.amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 });
          const matchAmount = rawAmount.includes(normalizedQuery) || formattedAmount.includes(searchQuery.trim());
          
          let matchDate = false;
          try {
            const dateObj = new Date(data.date);
            if (!isNaN(dateObj.getTime())) {
              matchDate = format(dateObj, 'dd.MM.yyyy').includes(normalizedQuery);
            }
          } catch {
            // Ignore invalid dates for search
          }
          
          const matchYear = data.monthYear ? data.monthYear.includes(normalizedQuery) : false;
          
          if (matchReseller || matchAmount || matchDate || matchYear) {
            results.push({ id: doc.id, ...data });
          }
        });
        
        // Sort newest first for global search
        results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (!cancelled) setGlobalSearchResults(results);
      } catch (error) {
        console.error("Search error:", error);
        if (!cancelled) setError("Pretraga nije uspjela. Pokušajte ponovno.");
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 400);

    return () => { cancelled = true; clearTimeout(delayDebounceFn); };
  }, [searchQuery, fetchData]);

  const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

  const toggleMonthStatus = async () => {
    if (!monthStatus || loading || statusSaving) return;
    const newStatus = !monthStatus.isClosed;
    const confirmMsg = newStatus 
      ? `Jeste li sigurni da želite ZAKLJUČITI ${displayMonthStr}? Nećete moći dodavati niti uređivati uplate.` 
      : `Jeste li sigurni da želite OTVORITI ${displayMonthStr}?`;
      
    if (confirm(confirmMsg)) {
      setStatusSaving(true);
      try {
        const statusRef = doc(db, "monthStatus", selectedMonthStr);
        await setDoc(statusRef, {
          id: selectedMonthStr,
          isClosed: newStatus,
          closedAt: newStatus ? new Date().toISOString() : null
        });
        fetchData();
      } catch (error) {
        console.error("Greška pri ažuriranju statusa mjeseca:", error);
        setError("Status mjeseca nije spremljen. Pokušajte ponovno.");
      } finally { setStatusSaving(false); }
    }
  };

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(59, 130, 246); // Accent blue
    doc.text(`Financijski Izvještaj`, 14, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(`Razdoblje: ${displayMonthStr}`, 14, 28);
    
    // Summary Box
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(14, 35, 182, 25, 3, 3, "F");
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Ukupni prihod:", 20, 46);
    doc.text("Broj uplata:", 20, 54);
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129); // Success green for revenue
    doc.text(`${formatCurrency(totalAmount)}`, 60, 46);
    doc.setTextColor(30, 30, 30);
    doc.text(`${payments.length}`, 60, 54);
    
    // Table Data
    const tableData = payments.map((p, i) => [
      i + 1,
      format(parseCustomDate(p.date), 'dd.MM.yyyy'),
      p.resellerName,
      `${p.amount.toFixed(2)} EUR`
    ]);

    autoTable(doc, {
      startY: 68,
      head: [['#', 'Datum', 'Klijent / Reseller', 'Iznos']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      styles: { font: "helvetica", fontSize: 10, cellPadding: 5 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 35 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
      }
    });
    
    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Stranica ${i} od ${pageCount} - Generirano: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 290);
    }

    doc.save(`Financijski_Izvjestaj_${selectedMonthStr}.pdf`);
  };

  const exportCSV = () => {
    const headers = ["Datum", "Reseller", "Iznos (EUR)"];
    const rows = payments.map(p => [
      format(parseCustomDate(p.date), 'dd.MM.yyyy'),
      p.resellerName,
      p.amount.toFixed(2)
    ]);
    
    const csvContent = [headers.join(";"), ...rows.map(r => r.map(value => `"${String(value).replace(/"/g, '""')}"`).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Uplate_${selectedMonthStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isGlobalSearchActive = !!searchQuery.trim() && globalSearchResults !== null;
  function changeSearch(value: string) { setSearchQuery(value); setGlobalSearchResults(null); setIsSearching(!!value.trim()); }

  return <section className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">Evidencija poslovanja</p><h1>Uplate</h1><p className="muted">Mjesečni pregled i brz unos uplata.</p></div><button className="button button-primary" disabled={loading || !!error || !monthStatus || monthStatus.isClosed || monthStatus.id !== selectedMonthStr} onClick={() => setShowForm(true)}><FiPlus/> Dodaj uplatu</button></div>
    <div className="period-bar">
      <div className="toolbar-actions"><button className="button button-icon" aria-label="Prethodni mjesec" onClick={handlePrevMonth}><FiChevronLeft/></button><label className="sr-only" htmlFor="payment-month">Mjesec pregleda</label><input id="payment-month" type="month" value={selectedMonthStr} onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) setCurrentDate(new Date(`${event.target.value}-01T12:00:00`)); }}/><button className="button button-icon" aria-label="Sljedeći mjesec" onClick={handleNextMonth}><FiChevronRight/></button><button className="text-button" onClick={() => setCurrentDate(new Date())}>Ovaj mjesec</button></div>
      <span className="status-badge">{loading ? "Učitavanje…" : monthStatus?.isClosed ? "Zaključen mjesec" : "Otvoren mjesec"}</span>
    </div>
    {error && <div role="alert" className="notice notice-error">{error} <button className="text-button" onClick={fetchData}>Pokušaj ponovno</button></div>}
    <div className="summary-grid"><div className="summary-card"><span>Uplate · {displayMonthStr}</span><strong>{loading || error ? "—" : formatCurrency(totalAmount)}</strong></div><div className="summary-card"><span>Broj uplata u mjesecu</span><strong>{loading || error ? "—" : payments.length}</strong></div><div className="summary-card"><span>Ukupno u {currentYear}.</span><strong>{loading || error ? "—" : formatCurrency(yearlyTotal)}</strong></div></div>
    <div className="list-toolbar"><div className="search-field"><FiSearch/><input aria-label="Pretraži uplate u svim mjesecima" placeholder="Pretraži sve uplate: reseller, iznos, datum…" value={searchQuery} onChange={event => { changeSearch(event.target.value); }}/>{searchQuery && <button className="text-button" onClick={() => changeSearch("")}>Očisti</button>}</div><details className="actions-menu"><summary className="button">Radnje za mjesec</summary><div className="actions-menu-content"><button className="button" disabled={loading || !!error} onClick={exportPDF}><FiFileText/> Preuzmi PDF</button><button className="button" disabled={loading || !!error} onClick={exportCSV}><FiDownload/> Preuzmi CSV (Excel)</button><button className="button" disabled={loading || statusSaving || !monthStatus} onClick={toggleMonthStatus}>{monthStatus?.isClosed ? "Ponovno otvori mjesec" : "Zaključi mjesec"}</button></div></details></div>
    {isGlobalSearchActive && <p className="muted">Pronađeno: {globalSearchResults?.length} · Svi mjeseci · Za uređivanje otvorite mjesec uplate.</p>}
    {loading || isSearching ? <p className="empty-state" role="status">{isSearching ? "Pretraživanje…" : "Učitavanje uplata…"}</p> : !error && <PaymentTable payments={isGlobalSearchActive ? globalSearchResults! : payments} isMonthClosed={isGlobalSearchActive || !monthStatus || monthStatus.isClosed} onPaymentChanged={fetchData}/>}
    {showForm && <SidePanel title="Nova uplata" onClose={() => { if (!paymentSaving) setShowForm(false); }}><PaymentForm onBusyChange={setPaymentSaving} key={selectedMonthStr} selectedMonth={selectedMonthStr} isMonthClosed={!monthStatus || monthStatus.isClosed} onPaymentAdded={() => { setShowForm(false); changeSearch(""); fetchData(); }}/></SidePanel>}
  </section>;
}
