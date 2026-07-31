"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CreditTransaction, Reseller, formatCurrency } from "@/lib/types";
import { FiTrendingUp, FiTrendingDown, FiActivity, FiPlus, FiTrash2, FiSearch } from "react-icons/fi";
import { format } from "date-fns";

export default function CreditsPage() {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'allocation' | 'repayment'>('allocation');
  
  // Form states
  const [selectedReseller, setSelectedReseller] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");
  const [payerName, setPayerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Fetch resellers
    const fetchResellers = async () => {
      const q = query(collection(db, "resellers"), orderBy("name"));
      const snapshot = await getDocs(q);
      const resData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reseller));
      setResellers(resData);
    };
    fetchResellers();

    // Listen to credit transactions
    const qTx = query(collection(db, "credit_transactions"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(qTx, (snapshot) => {
      const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreditTransaction));
      setTransactions(txData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openModal = (type: 'allocation' | 'repayment') => {
    setModalType(type);
    setSelectedReseller("");
    setAmount("");
    setNotes("");
    setPayerName("");
    setDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReseller || !amount || !date) return;

    setIsSubmitting(true);
    try {
      const tx: any = {
        resellerName: selectedReseller,
        type: modalType,
        amount: parseFloat(amount.replace(',', '.')),
        date: date,
        notes: notes || undefined,
        payerName: payerName.trim() || undefined,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "credit_transactions"), tx);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error adding transaction:", error);
      alert("Dogodila se greška prilikom dodavanja.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Jeste li sigurni da želite obrisati ovu transakciju?")) {
      await deleteDoc(doc(db, "credit_transactions", id));
    }
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

  // Search filter for transactions
  const filteredTransactions = transactions.filter(tx => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return tx.resellerName.toLowerCase().includes(query) || 
           tx.amount.toString().includes(query) ||
           (tx.payerName && tx.payerName.toLowerCase().includes(query));
  });

  if (loading) {
    return <div style={{ padding: '2rem', color: 'white' }}>Učitavanje kredita...</div>;
  }

  return (
    <div className="animate-fade-in" style={{ padding: '1rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'white', margin: 0 }}>Sustav Kredita</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => openModal('allocation')}
            style={{
              padding: '0.75rem 1.2rem', background: 'var(--danger)', color: 'white',
              border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
            }}>
            <FiTrendingUp /> Izdaj Kredit
          </button>
          <button 
            onClick={() => openModal('repayment')}
            style={{
              padding: '0.75rem 1.2rem', background: 'var(--success)', color: 'white',
              border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}>
            <FiTrendingDown /> Upiši Otplatu
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass stat-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '12px' }}>
              <FiTrendingUp size={24} />
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ukupno Izdano</p>
              <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'white' }}>{formatCurrency(totalAllocated)}</h3>
            </div>
          </div>
        </div>
        
        <div className="glass stat-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '12px' }}>
              <FiTrendingDown size={24} />
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ukupno Otplaćeno</p>
              <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'white' }}>{formatCurrency(totalRepaid)}</h3>
            </div>
          </div>
        </div>

        <div className="glass stat-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent)', borderRadius: '12px' }}>
              <FiActivity size={24} />
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Trenutno Nenaplaćeno (Dug)</p>
              <h3 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--accent)' }}>{formatCurrency(totalOutstanding)}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Balances Table */}
        <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, color: 'white' }}>Stanje po Resellerima</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Prikaz onih s aktivnim povijestima</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '1rem 1.5rem' }}>Reseller</th>
                  <th style={{ padding: '1rem 1.5rem' }}>Izdano</th>
                  <th style={{ padding: '1rem 1.5rem' }}>Otplaćeno</th>
                  <th style={{ padding: '1rem 1.5rem' }}>Preostali Dug</th>
                </tr>
              </thead>
              <tbody>
                {balanceArray.map((b, i) => (
                  <tr key={b.name} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '1rem 1.5rem', color: 'white', fontWeight: '500' }}>{b.name}</td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--danger)' }}>{formatCurrency(b.allocated)}</td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--success)' }}>{formatCurrency(b.repaid)}</td>
                    <td style={{ padding: '1rem 1.5rem', color: b.debt > 0 ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 'bold' }}>
                      {formatCurrency(b.debt)}
                    </td>
                  </tr>
                ))}
                {balanceArray.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nema aktivnih kredita</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transactions History */}
        <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, color: 'white' }}>Povijest Transakcija</h3>
            </div>
            <div style={{ position: 'relative' }}>
              <FiSearch style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Pretraži transakcije..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '8px', color: 'white',
                  outline: 'none', width: '200px'
                }}
              />
            </div>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '1rem 1.5rem' }}>Datum</th>
                  <th style={{ padding: '1rem 1.5rem' }}>Reseller</th>
                  <th style={{ padding: '1rem 1.5rem' }}>Tip</th>
                  <th style={{ padding: '1rem 1.5rem' }}>Iznos</th>
                  <th style={{ padding: '1rem 1.5rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx, i) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)' }}>
                      {format(new Date(tx.date), 'dd.MM.yyyy')}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: 'white', fontWeight: '500' }}>
                      {tx.resellerName}
                      {tx.payerName && (
                        <div style={{ fontSize: '0.8em', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Uplatio: {tx.payerName}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        background: tx.type === 'allocation' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: tx.type === 'allocation' ? 'var(--danger)' : 'var(--success)'
                      }}>
                        {tx.type === 'allocation' ? 'KREDIT' : 'OTPLATA'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: 'white', fontWeight: 'bold' }}>
                      {tx.type === 'allocation' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <button onClick={() => handleDelete(tx.id!)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <FiTrash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nema pronađenih transakcija</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal for adding transaction */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
        }}>
          <div className="glass" style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '400px', border: '1px solid var(--border)' }}>
            <h2 style={{ margin: '0 0 1.5rem 0', color: 'white' }}>
              {modalType === 'allocation' ? 'Izdaj Novi Kredit' : 'Upiši Otplatu Kredita'}
            </h2>
            
            <form onSubmit={handleAddTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Reseller</label>
                <select 
                  value={selectedReseller} 
                  onChange={e => setSelectedReseller(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'white' }}
                >
                  <option value="">Odaberite resellera...</option>
                  {resellers.map(r => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>
              
              {modalType === 'repayment' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Ime Uplatitelja / Subsellera (Opcionalno)</label>
                  <input 
                    type="text" 
                    placeholder="Npr. Ahmet"
                    value={payerName}
                    onChange={e => setPayerName(e.target.value)}
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'white' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Iznos (€)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 'bold' }}>€</span>
                  <input  
                    type="number" 
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.5rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'white' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Datum</label>
                <input 
                  type="date" 
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'white' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Bilješka (opcionalno)</label>
                <input 
                  type="text" 
                  placeholder="Npr. Kratkoročna pozajmica"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'white' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid var(--border)', color: 'white', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Odustani
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ flex: 1, padding: '0.8rem', background: modalType === 'allocation' ? 'var(--danger)' : 'var(--success)', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {isSubmitting ? 'Spremanje...' : 'Spremi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
