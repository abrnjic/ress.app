"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Reseller, Payment, formatCurrency } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { FiArrowLeft, FiEdit3, FiMail, FiPhone, FiCalendar, FiDollarSign } from "react-icons/fi";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
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

export default function ResellerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const resellerId = params.id as string;

  const [reseller, setReseller] = useState<Reseller | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!resellerId) return;

    const fetchProfile = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, "resellers", resellerId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const rData = { id: docSnap.id, ...docSnap.data() } as Reseller;
          setReseller(rData);
          setEditEmail(rData.email || "");
          setEditPhone(rData.phone || "");
          setEditNotes(rData.notes || "");

          // Fetch payments for this reseller
          const q = query(collection(db, "payments"), where("resellerName", "==", rData.name));
          const paySnap = await getDocs(q);
          const pList: Payment[] = [];
          paySnap.forEach(p => pList.push({ id: p.id, ...p.data() } as Payment));
          
          pList.sort((a, b) => parseCustomDate(a.date).getTime() - parseCustomDate(b.date).getTime());
          setPayments(pList);
        } else {
          router.push("/dashboard/resellers");
        }
      } catch (error) {
        console.error("Greška pri učitavanju profila:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [resellerId, router]);

  const handleSaveProfile = async () => {
    if (!reseller) return;
    setSaving(true);
    try {
      const docRef = doc(db, "resellers", reseller.id!);
      await updateDoc(docRef, {
        email: editEmail,
        phone: editPhone,
        notes: editNotes
      });
      setReseller({ ...reseller, email: editEmail, phone: editPhone, notes: editNotes });
      setIsEditing(false);
    } catch (error) {
      console.error("Greška pri spremanju profila:", error);
      alert("Greška pri spremanju promjena.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Učitavanje profila klijenata...</div>;
  }

  if (!reseller) return null;

  // LTV (Lifetime Value)
  const lifetimeValue = payments.reduce((sum, p) => sum + p.amount, 0);

  // Chart data
  const chartData = payments.map(p => ({
    Datum: format(parseCustomDate(p.date), 'dd.MM.yyyy'),
    Iznos: p.amount
  }));

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
      
      <button 
        onClick={() => router.push('/dashboard/resellers')}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '1.5rem', fontWeight: '600', padding: 0 }}
      >
        <FiArrowLeft /> Nazad na sve klijente
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* Profile Card */}
        <div className="glass" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 0.5rem 0', letterSpacing: '-0.025em' }}>{reseller.name}</h1>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '999px', fontSize: '0.875rem', fontWeight: '600' }}>
                <FiCalendar /> Aktivan klijent
              </span>
            </div>
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }} title="Uredi Profil">
                <FiEdit3 size={18} />
              </button>
            )}
          </div>

          {!isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-secondary)' }}>
                <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '12px' }}><FiMail size={20} /></div>
                <div>
                  <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Email</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '1rem' }}>{reseller.email || "Nije uneseno"}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-secondary)' }}>
                <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '12px' }}><FiPhone size={20} /></div>
                <div>
                  <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Mobitel</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '1rem' }}>{reseller.phone || "Nije uneseno"}</div>
                </div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '0.25rem' }}>Bilješke</div>
                <div style={{ color: 'var(--text-primary)', fontStyle: reseller.notes ? 'normal' : 'italic', whiteSpace: 'pre-wrap' }}>
                  {reseller.notes || "Nema bilješki o klijentu."}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Email</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Mobitel</label>
                <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Bilješke</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={4} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button onClick={handleSaveProfile} disabled={saving} style={{ flex: 1, padding: '0.75rem', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  {saving ? "Spremanje..." : "Spremi promjene"}
                </button>
                <button onClick={() => setIsEditing(false)} style={{ padding: '0.75rem 1rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Odustani
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Analytics & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 4px 12px var(--accent-glow)' }}>
                <FiDollarSign size={28} />
              </div>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', margin: '0 0 0.25rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ukupan Prihod (LTV)</p>
                <h3 style={{ fontSize: '1.75rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>{formatCurrency(lifetimeValue)}</h3>
              </div>
            </div>

            <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
                <FiCalendar size={24} />
              </div>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', margin: '0 0 0.25rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Broj Uplata</p>
                <h3 style={{ fontSize: '1.75rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>{payments.length}</h3>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="glass" style={{ padding: '2rem', borderRadius: '16px' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>Povijest uplata</h3>
            {payments.length > 0 ? (
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="Datum" stroke="var(--text-muted)" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `€${val}`} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
                      itemStyle={{ color: 'var(--accent)', fontWeight: 'bold' }}
                      labelStyle={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}
                    />
                    <Line type="monotone" dataKey="Iznos" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4, fill: 'var(--bg-card)', strokeWidth: 2 }} activeDot={{ r: 6, fill: 'var(--accent)', stroke: 'var(--bg-card)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Nema zabilježenih uplata za ovog klijenta.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
