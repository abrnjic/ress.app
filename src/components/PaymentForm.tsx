"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Payment, formatName } from "@/lib/types";
import { format } from "date-fns";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { hr } from "date-fns/locale/hr";

interface PaymentFormProps {
  onPaymentAdded: () => void;
  selectedMonth: string;
  isMonthClosed: boolean;
}

export default function PaymentForm({ onPaymentAdded, selectedMonth, isMonthClosed }: PaymentFormProps) {
  const [resellers, setResellers] = useState<string[]>([]);
  const [resellerName, setResellerName] = useState("");
  const [isNewReseller, setIsNewReseller] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchResellers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "resellers"));
        const names: string[] = [];
        querySnapshot.forEach((doc) => {
          names.push(doc.data().name);
        });
        setResellers(names.sort((a, b) => a.localeCompare(b)));
      } catch (error) {
        console.error("Error fetching resellers:", error);
      }
    };
    fetchResellers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMonthClosed) {
      alert("Ovaj mjesec je zaključen. Ne možete dodavati nove uplate.");
      return;
    }
    if (!date) {
      alert("Molimo odaberite datum.");
      return;
    }
    setLoading(true);
    try {
      const newPayment: Payment = {
        resellerName: formatName(resellerName.trim()),
        amount: parseFloat(amount),
        currency: "EUR",
        date: date.toISOString(),
        monthYear: selectedMonth,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, "payments"), newPayment);
      setAmount("");
      onPaymentAdded();
    } catch (error) {
      console.error("Error adding payment: ", error);
      alert("Greška pri dodavanju uplate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass" style={{ padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Dodaj novu uplatu</h3>
      <form onSubmit={handleSubmit} className="responsive-form-row">
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>Reseller</label>
          {!isNewReseller ? (
            <select 
              value={resellerName} 
              onChange={(e) => {
                if (e.target.value === 'NEW') setIsNewReseller(true);
                else setResellerName(e.target.value);
              }}
              required
              style={{ padding: '0.625rem 0.875rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', transition: 'all 0.3s' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--border-focus)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
            >
              <option value="" disabled>Odaberite resellera</option>
              {resellers.map(r => <option key={r} value={r}>{r}</option>)}
              <option value="NEW" style={{ fontWeight: 'bold', color: 'var(--accent)' }}>+ Dodaj novog resellera</option>
            </select>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="Ime novog resellera" 
                value={resellerName} 
                onChange={(e) => setResellerName(e.target.value)} 
                required 
                style={{ flex: 1, padding: '0.625rem 0.875rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', transition: 'all 0.3s' }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--border-focus)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
              <button 
                type="button" 
                onClick={() => { setIsNewReseller(false); setResellerName(""); }}
                style={{ width: '40px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 'bold' }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                X
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>Iznos (EUR)</label>
          <input 
            type="number" 
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            style={{ padding: '0.625rem 0.875rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', transition: 'all 0.3s' }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--border-focus)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>Datum</label>
          <div style={{ display: 'flex' }}>
            <DatePicker 
              selected={date}
              onChange={(d: Date | null) => setDate(d)}
              dateFormat="dd.MM.yyyy."
              locale={hr}
              required
              wrapperClassName="datepicker-wrapper"
              customInput={
                <input style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem', cursor: 'pointer', outline: 'none', transition: 'all 0.3s' }} 
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--border-focus)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                />
              }
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading || isMonthClosed}
          style={{ 
            padding: '0.625rem 1rem', 
            borderRadius: '8px', 
            border: 'none', 
            background: isMonthClosed ? 'var(--bg-hover)' : 'linear-gradient(135deg, var(--accent), var(--accent-hover))', 
            color: isMonthClosed ? 'var(--text-muted)' : 'white', 
            fontWeight: '700',
            fontSize: '0.9rem',
            cursor: isMonthClosed ? 'not-allowed' : 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: isMonthClosed ? 'none' : '0 4px 12px var(--accent-glow)'
          }}
          onMouseOver={(e) => {
            if (!isMonthClosed) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.6)';
            }
          }}
          onMouseOut={(e) => {
            if (!isMonthClosed) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px var(--accent-glow)';
            }
          }}
        >
          {loading ? 'Dodavanje...' : 'Dodaj uplatu'}
        </button>
      </form>
    </div>
  );
}
