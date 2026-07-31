"use client";

import { useState } from "react";
import { Payment, formatName, formatCurrency } from "@/lib/types";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";

interface PaymentTableProps {
  payments: Payment[];
  isMonthClosed: boolean;
  onPaymentChanged: () => void;
}

export default function PaymentTable({ payments, isMonthClosed, onPaymentChanged }: PaymentTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>("");

  const handleDelete = async (id: string) => {
    if (isMonthClosed) return;
    if (confirm("Are you sure you want to delete this payment?")) {
      try {
        await deleteDoc(doc(db, "payments", id));
        onPaymentChanged();
      } catch (error) {
        console.error("Error deleting document: ", error);
      }
    }
  };

  const handleEdit = (payment: Payment) => {
    if (isMonthClosed) return;
    setEditingId(payment.id!);
    setEditAmount(payment.amount.toString());
  };

  const handleSave = async (id: string) => {
    try {
      await updateDoc(doc(db, "payments", id), {
        amount: parseFloat(editAmount)
      });
      setEditingId(null);
      onPaymentChanged();
    } catch (error) {
      console.error("Error updating document: ", error);
    }
  };

  return (
    <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '0.2rem 0.4rem', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datum</th>
              <th style={{ padding: '0.2rem 0.4rem', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reseller</th>
              <th style={{ padding: '0.2rem 0.4rem', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Iznos</th>
              <th style={{ padding: '0.2rem 0.4rem', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Akcije</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '2rem' }}>📭</span>
                    <span>Nema uplata za ovaj period.</span>
                  </div>
                </td>
              </tr>
            ) : (
              payments.map((p, index) => (
                <tr 
                  key={p.id} 
                  style={{ 
                    borderTop: '1px solid var(--border)', 
                    transition: 'all 0.2s ease',
                    background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'
                  }} 
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.transform = 'scale(1.002)';
                  }} 
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <td style={{ padding: '0.15rem 0.4rem', color: 'var(--text-secondary)' }}>
                    {(() => {
                      try {
                        const dateObj = new Date(p.date);
                        if (isNaN(dateObj.getTime())) return p.date;
                        return format(dateObj, 'dd.MM.yyyy');
                      } catch (e) {
                        return p.date;
                      }
                    })()}
                  </td>
                  <td style={{ padding: '0.15rem 0.4rem', fontWeight: '600', color: 'var(--text-primary)' }}>{formatName(p.resellerName)}</td>
                  <td style={{ padding: '0.15rem 0.4rem' }}>
                    {editingId === p.id ? (
                      <input 
                        type="number" 
                        step="0.01" 
                        value={editAmount} 
                        onChange={(e) => setEditAmount(e.target.value)}
                        style={{ padding: '0.5rem 0.75rem', width: '120px', borderRadius: '8px', border: '2px solid var(--accent)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
                        autoFocus
                      />
                    ) : (
                      <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{formatCurrency(p.amount)}</span>
                    )}
                  </td>
                  <td style={{ padding: '0.15rem 0.4rem', textAlign: 'right' }}>
                    {editingId === p.id ? (
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => handleSave(p.id!)} style={{ padding: '0.5rem 1rem', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600' }}>Spremi</button>
                        <button onClick={() => setEditingId(null)} style={{ padding: '0.5rem 1rem', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: '500' }}>Odustani</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => handleEdit(p)} 
                          disabled={isMonthClosed}
                          style={{ padding: '0.5rem 1rem', background: 'var(--bg-secondary)', color: isMonthClosed ? 'var(--text-muted)' : 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px', cursor: isMonthClosed ? 'not-allowed' : 'pointer', fontWeight: '500', transition: 'all 0.2s' }}
                          onMouseOver={(e) => { if(!isMonthClosed) { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'var(--accent)'; }}}
                          onMouseOut={(e) => { if(!isMonthClosed) { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}}
                        >
                          Uredi
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id!)} 
                          disabled={isMonthClosed}
                          style={{ padding: '0.5rem 1rem', background: isMonthClosed ? 'var(--bg-secondary)' : 'rgba(239, 68, 68, 0.1)', color: isMonthClosed ? 'var(--text-muted)' : 'var(--danger)', border: isMonthClosed ? '1px solid var(--border)' : '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', cursor: isMonthClosed ? 'not-allowed' : 'pointer', fontWeight: '500', transition: 'all 0.2s' }}
                          onMouseOver={(e) => { if(!isMonthClosed) { e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'var(--danger)'; }}}
                          onMouseOut={(e) => { if(!isMonthClosed) { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'; }}}
                        >
                          Obriši
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
