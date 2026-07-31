"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Reseller, Payment, formatName } from "@/lib/types";
import { FiTrash2, FiDownload, FiRefreshCw, FiMail, FiPhone, FiChevronRight } from "react-icons/fi";
import { useRouter } from "next/navigation";

export default function ResellersPage() {
  const router = useRouter();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const fetchResellers = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "resellers"));
      const fetched: Reseller[] = [];
      snapshot.forEach(doc => fetched.push({ id: doc.id, ...doc.data() } as Reseller));
      fetched.sort((a, b) => a.name.localeCompare(b.name));
      setResellers(fetched);
    } catch (error) {
      console.error("Greška pri dohvaćanju resellera:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResellers();
  }, []);

  const handleImport = async () => {
    if (!confirm("Jeste li sigurni da želite uvesti sve resellere iz starih uplata? Ovo može potrajati par sekundi.")) return;
    
    setImporting(true);
    try {
      const paymentsSnap = await getDocs(collection(db, "payments"));
      const uniqueNames = new Set<string>();
      
      paymentsSnap.forEach(doc => {
        const data = doc.data() as Payment;
        if (data.resellerName) {
          uniqueNames.add(formatName(data.resellerName));
        }
      });

      const existingSnap = await getDocs(collection(db, "resellers"));
      const existingNames = new Set<string>();
      existingSnap.forEach(doc => existingNames.add((doc.data() as Reseller).name));

      let addedCount = 0;
      for (const name of uniqueNames) {
        if (!existingNames.has(name)) {
          await addDoc(collection(db, "resellers"), {
            name,
            email: "",
            phone: "",
            notes: "",
            createdAt: new Date().toISOString()
          });
          addedCount++;
        }
      }
      
      alert(`Uspješno uvezeno ${addedCount} novih resellera!`);
      fetchResellers();
    } catch (error) {
      console.error("Greška pri uvozu:", error);
      alert("Došlo je do greške pri uvozu.");
    } finally {
      setImporting(false);
    }
  };

  const handleSync = async () => {
    if (!confirm("Ovo će obrisati sve duplikate i resellere koji više nemaju nijednu uplatu, te dodati one koji nedostaju. Nastaviti?")) return;
    
    setSyncing(true);
    try {
      const paymentsSnap = await getDocs(collection(db, "payments"));
      const activeNames = new Set<string>();
      paymentsSnap.forEach(doc => {
        const data = doc.data() as Payment;
        if (data.resellerName) {
          activeNames.add(data.resellerName.trim());
        }
      });

      const existingSnap = await getDocs(collection(db, "resellers"));
      const seenNames = new Set<string>();
      let deletedCount = 0;
      let addedCount = 0;

      for (const document of existingSnap.docs) {
        const rData = document.data() as Reseller;
        const name = rData.name.trim();

        if (!activeNames.has(name) || seenNames.has(name)) {
          await deleteDoc(doc(db, "resellers", document.id));
          deletedCount++;
        } else {
          seenNames.add(name);
        }
      }

      for (const name of activeNames) {
        if (!seenNames.has(name)) {
          await addDoc(collection(db, "resellers"), {
            name,
            email: "",
            phone: "",
            notes: "",
            createdAt: new Date().toISOString()
          });
          addedCount++;
        }
      }

      alert(`Sinkronizacija završena!\nObrisano neaktivnih/duplikata: ${deletedCount}\nDodano novih: ${addedCount}`);
      fetchResellers();
    } catch (error) {
      console.error("Greška pri sinkronizaciji:", error);
      alert("Došlo je do greške pri sinkronizaciji.");
    } finally {
      setSyncing(false);
    }
  };

  const handleAddReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      await addDoc(collection(db, "resellers"), {
        name: formatName(newName),
        email: newEmail,
        phone: newPhone,
        notes: newNotes,
        createdAt: new Date().toISOString()
      });
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewNotes("");
      fetchResellers();
    } catch (error) {
      console.error("Greška pri dodavanju:", error);
      alert("Greška pri dodavanju resellera.");
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Jeste li sigurni da želite obrisati ovog resellera? (Ovo ne briše njegove dosadašnje uplate)")) {
      try {
        await deleteDoc(doc(db, "resellers", id));
        fetchResellers();
      } catch (error) {
        console.error("Error deleting reseller:", error);
      }
    }
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.025em' }}>CRM Baza Klijenata</h1>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={handleSync}
            disabled={syncing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '12px', fontWeight: '600', cursor: syncing ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
          >
            <FiRefreshCw className={syncing ? "spin" : ""} />
            {syncing ? "Sinkroniziram..." : "Očisti i Sinkroniziraj"}
          </button>
          
          {resellers.length === 0 && !loading && (
            <button 
              onClick={handleImport}
              disabled={importing}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: importing ? 'not-allowed' : 'pointer' }}
            >
              <FiDownload />
              {importing ? "Uvoz u tijeku..." : "Uvezi iz starih uplata"}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        
        {/* Add Reseller Form */}
        <div className="glass" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', color: 'var(--text-primary)' }}>Novi Reseller</h2>
          <form onSubmit={handleAddReseller} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>Ime</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>Email (Opcionalno)</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>Mobitel (Opcionalno)</label>
              <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>Bilješke (Opcionalno)</label>
              <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={3} style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
            </div>
            <button type="submit" style={{ padding: '0.875rem', background: 'linear-gradient(135deg, var(--success), #059669)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', marginTop: '0.5rem' }}>
              Dodaj u Bazu
            </button>
          </form>
        </div>

        {/* Resellers Grid */}
        <div style={{ gridColumn: 'span 2' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Učitavanje profila...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {resellers.map(r => (
                  <div key={r.id} className="glass" onClick={() => router.push(`/dashboard/resellers/${r.id}`)} style={{ 
                    padding: '1.5rem', 
                    borderRadius: '16px', 
                    border: '1px solid var(--border)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1rem',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    height: '100%'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{r.name}</h3>
                      <button onClick={(e) => handleDelete(r.id!, e)} style={{ background: 'var(--bg-secondary)', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', transition: 'all 0.2s' }} title="Obriši">
                        <FiTrash2 />
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {r.email && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}><FiMail size={14}/> {r.email}</div>}
                      {r.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}><FiPhone size={14}/> {r.phone}</div>}
                      {!r.email && !r.phone && <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Nema kontakt podataka</div>}
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: 'var(--accent)', fontSize: '0.875rem', fontWeight: '600' }}>
                      Prikaži Profil <FiChevronRight />
                    </div>
                  </div>
              ))}
              {resellers.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: '16px' }}>
                  Nema dodanih klijenata u bazi. Uvezite ih ili dodajte ručno.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
