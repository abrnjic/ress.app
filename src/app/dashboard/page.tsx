"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Payment, MonthStatus, formatCurrency } from "@/lib/types";
import { format, subMonths, addMonths } from "date-fns";
import { hr } from "date-fns/locale/hr";
import PaymentForm from "@/components/PaymentForm";
import PaymentTable from "@/components/PaymentTable";
import { FiDownload, FiFileText, FiAlertCircle } from "react-icons/fi";
import jsPDF from "jspdf";
import "jspdf-autotable";
import confetti from "canvas-confetti";

export default function DashboardPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [monthStatus, setMonthStatus] = useState<MonthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [yearlyTotal, setYearlyTotal] = useState(0);

  // Global search state
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<Payment[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const selectedMonthStr = format(currentDate, "yyyy-MM");
  const displayMonthStr = format(currentDate, "MMMM yyyy", { locale: hr }).replace(/^\w/, c => c.toUpperCase());
  const currentYear = format(currentDate, "yyyy");

  const fetchData = useCallback(async () => {
    if (searchQuery.trim()) return; // Don't fetch monthly data if searching globally
    
    setLoading(true);
    try {
      const statusRef = doc(db, "monthStatus", selectedMonthStr);
      const statusSnap = await getDoc(statusRef);
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

      fetchedPayments.sort((a, b) => getDayForSort(a.date) - getDayForSort(b.date));
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
      setYearlyTotal(yTotal);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonthStr, currentYear, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Global Search Effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setGlobalSearchResults(null);
      fetchData(); // Refetch monthly data when search clears
      return;
    }
    
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
          } catch (e) {
            // Ignore invalid dates for search
          }
          
          const matchYear = data.monthYear ? data.monthYear.includes(normalizedQuery) : false;
          
          if (matchReseller || matchAmount || matchDate || matchYear) {
            results.push({ id: doc.id, ...data });
          }
        });
        
        // Sort newest first for global search
        results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setGlobalSearchResults(results);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, fetchData]);

  const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

  const toggleMonthStatus = async () => {
    if (!monthStatus) return;
    const newStatus = !monthStatus.isClosed;
    const confirmMsg = newStatus 
      ? `Jeste li sigurni da želite ZAKLJUČITI ${displayMonthStr}? Nećete moći dodavati niti uređivati uplate.` 
      : `Jeste li sigurni da želite OTVORITI ${displayMonthStr}?`;
      
    if (confirm(confirmMsg)) {
      try {
        const statusRef = doc(db, "monthStatus", selectedMonthStr);
        await setDoc(statusRef, {
          id: selectedMonthStr,
          isClosed: newStatus,
          closedAt: newStatus ? new Date().toISOString() : null
        });
        fetchData();
        if (newStatus) {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
          });
        }
      } catch (error) {
        console.error("Greška pri ažuriranju statusa mjeseca:", error);
      }
    }
  };

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value, 10);
    const newDate = new Date(currentDate);
    newDate.setFullYear(newYear);
    setCurrentDate(newDate);
  };

  const years = [2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];

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
      format(new Date(p.date), 'dd.MM.yyyy'),
      p.resellerName,
      `${p.amount.toFixed(2)} EUR`
    ]);

    (doc as any).autoTable({
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
    const pageCount = (doc as any).internal.getNumberOfPages();
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
      format(new Date(p.date), 'dd.MM.yyyy'),
      p.resellerName,
      p.amount.toFixed(2)
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Uplate_${selectedMonthStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isGlobalSearchActive = globalSearchResults !== null;

  return (
    <div className="animate-fade-in">
      {/* Super Search Bar */}
      <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
        <input 
          type="text"
          placeholder="🔍 Super Pretraživač (Ime, iznos, datum...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="glass"
          style={{ 
            width: '100%', 
            padding: '0.875rem 1rem', 
            fontSize: '1rem', 
            borderRadius: '12px', 
            border: '2px solid transparent', 
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'all 0.3s ease',
            backgroundClip: 'padding-box',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--accent)';
            e.target.style.boxShadow = '0 0 0 4px var(--accent-glow)';
            e.target.style.transform = 'translateY(-2px)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'transparent';
            e.target.style.boxShadow = 'var(--premium-shadow)';
            e.target.style.transform = 'translateY(0)';
          }}
        />
      </div>

      {!isGlobalSearchActive && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Nadzorna ploča</h1>
            
            <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 1rem', borderRadius: '12px' }}>
              <button onClick={handlePrevMonth} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.25rem', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent)'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>&larr;</button>
              <span style={{ fontSize: '1.1rem', fontWeight: '700', minWidth: '150px', textAlign: 'center', color: 'var(--text-primary)' }}>{displayMonthStr}</span>
              <button onClick={handleNextMonth} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.25rem', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent)'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>&rarr;</button>
              
              <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 0.5rem' }}></div>
              
              <select 
                value={currentYear}
                onChange={handleYearChange}
                style={{ padding: '0.5rem', background: 'transparent', color: 'var(--text-primary)', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', outline: 'none' }}
              >
                {years.map(y => <option key={y} value={y} style={{ background: 'var(--bg-primary)' }}>{y}.</option>)}
              </select>
            </div>
          </div>

          <div className="responsive-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem', display: 'grid' }}>
            <div className="glass" style={{ padding: '1.25rem', borderRadius: '12px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'var(--accent)', opacity: 0.1, filter: 'blur(30px)', borderRadius: '50%' }}></div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.9rem', fontWeight: '500' }}>Ukupna uplata ({displayMonthStr})</p>
              <p style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.025em', margin: 0 }}>
                <span style={{ color: 'var(--accent)' }}>€</span> {totalAmount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="glass" style={{ padding: '1.25rem', borderRadius: '12px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'var(--success)', opacity: 0.1, filter: 'blur(30px)', borderRadius: '50%' }}></div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.9rem', fontWeight: '500' }}>Ukupna uplata ({currentYear}.)</p>
              <p style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.025em', margin: 0 }}>
                <span style={{ color: 'var(--success)' }}>€</span> {yearlyTotal.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="glass" style={{ padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center' }}>
              <button 
                onClick={toggleMonthStatus}
                style={{ 
                  padding: '0.75rem', 
                  borderRadius: '8px', 
                  border: 'none', 
                  background: monthStatus?.isClosed ? 'var(--bg-hover)' : 'linear-gradient(135deg, var(--danger), var(--danger-hover))', 
                  color: 'var(--text-primary)', 
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'transform 0.2s',
                  boxShadow: monthStatus?.isClosed ? 'none' : '0 4px 12px rgba(239, 68, 68, 0.3)'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {monthStatus?.isClosed ? 'Mjesec je zaključen (Klikni za otvaranje)' : 'Zaključi mjesec'}
              </button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={exportPDF} style={{ flex: 1, padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'var(--accent)'; }} onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                  <FiFileText /> PDF
                </button>
                <button onClick={exportCSV} style={{ flex: 1, padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.background = 'var(--success)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'var(--success)'; }} onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                  <FiDownload /> Excel
                </button>
              </div>
            </div>
          </div>
          
          <PaymentForm 
            selectedMonth={selectedMonthStr} 
            isMonthClosed={monthStatus?.isClosed || false}
            onPaymentAdded={fetchData}
          />
        </>
      )}

      {isGlobalSearchActive && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', color: 'var(--accent)' }}>
            Rezultati pretrage: "{searchQuery}"
          </h2>
          <span style={{ background: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid var(--border)' }}>
            Pronađeno: {globalSearchResults?.length || 0}
          </span>
        </div>
      )}

      {loading || isSearching ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          {isSearching ? 'Pretraživanje...' : 'Učitavanje uplata...'}
        </div>
      ) : (
        <PaymentTable 
          payments={isGlobalSearchActive ? globalSearchResults! : payments} 
          isMonthClosed={isGlobalSearchActive ? true : (monthStatus?.isClosed || false)}
          onPaymentChanged={fetchData}
        />
      )}
    </div>
  );
}
