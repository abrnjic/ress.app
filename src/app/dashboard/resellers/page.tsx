"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Reseller, Payment, formatName } from "@/lib/types";
import { FiPlus, FiSearch, FiChevronRight } from "react-icons/fi";
import SidePanel from "@/components/SidePanel";
import ResellerDetails from "@/components/ResellerDetails";


export default function ResellersPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Reseller | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const fetchResellers = async () => {
    setLoading(true);
    setError("");
    try {
      const snapshot = await getDocs(collection(db, "resellers"));
      const fetched: Reseller[] = [];
      snapshot.forEach(doc => fetched.push({ id: doc.id, ...doc.data() } as Reseller));
      fetched.sort((a, b) => a.name.localeCompare(b.name));
      setResellers(fetched);
    } catch (error) {
      console.error("Greška pri dohvaćanju resellera:", error);
      setError("Reselleri nisu učitani. Pokušajte ponovno.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial synchronization with the stored reseller profiles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchResellers();
  }, []);

  const handleImport = async () => {
    if (!confirm("Dodati profile koji nedostaju na temelju starih uplata? Postojeći profili i uplate ostaju nepromijenjeni.")) return;
    
    setImporting(true);
    try {
      const paymentsSnap = await getDocs(collection(db, "payments"));
      const uniqueNames = new Set<string>();
      
      paymentsSnap.forEach(doc => {
        const data = doc.data() as Payment;
        if (data.resellerName) {
          uniqueNames.add(data.resellerName);
        }
      });

      const existingSnap = await getDocs(collection(db, "resellers"));
      const existingNames = new Set<string>();
      existingSnap.forEach(doc => existingNames.add((doc.data() as Reseller).name.trim().toLocaleLowerCase("hr")));

      let addedCount = 0;
      for (const name of uniqueNames) {
        if (!existingNames.has(name.trim().toLocaleLowerCase("hr"))) {
          await addDoc(collection(db, "resellers"), {
            name,
            email: "",
            phone: "",
            notes: "",
            createdAt: new Date().toISOString()
          });
          existingNames.add(name.trim().toLocaleLowerCase("hr"));
          addedCount++;
        }
      }
      
      setMessage(`Dodano profila: ${addedCount}. Postojeći podaci nisu mijenjani.`);
      fetchResellers();
    } catch (error) {
      console.error("Greška pri uvozu:", error);
      setError("Dodavanje profila nije dovršeno. Osvježite popis prije ponovnog pokušaja.");
    } finally {
      setImporting(false);
    }
  };

  const handleAddReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || saving) return;
    const name = formatName(newName.trim());
    if (resellers.some(item => item.name.trim().toLocaleLowerCase("hr") === name.toLocaleLowerCase("hr"))) { setError("Reseller s tim imenom već postoji. Pronađite ga na popisu."); return; }
    setSaving(true);
    setError("");

    try {
      await addDoc(collection(db, "resellers"), {
        name,
        email: newEmail,
        phone: newPhone,
        notes: newNotes,
        createdAt: new Date().toISOString()
      });
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewNotes("");
      setShowNew(false);
      setMessage("Reseller je dodan.");
      fetchResellers();
    } catch (error) {
      console.error("Greška pri dodavanju:", error);
      setError("Reseller nije spremljen. Pokušajte ponovno.");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Jeste li sigurni da želite obrisati ovog resellera? (Ovo ne briše njegove dosadašnje uplate)")) {
      try {
        await deleteDoc(doc(db, "resellers", id));
        setSelected(null);
        fetchResellers();
      } catch (error) {
        console.error("Error deleting reseller:", error);
        setError("Profil nije obrisan. Pokušajte ponovno.");
      }
    }
  };

  const normalized = (value: string) => value.toLocaleLowerCase("hr").replace(/đ/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const visible = resellers.filter(item => normalized(`${formatName(item.name)} ${item.email || ""} ${item.phone || ""}`).includes(normalized(search.trim())));
  return <section className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">Vaši poslovni kontakti</p><h1>Reselleri</h1><p className="muted">Kontakti, uplate i dugovanja na jednom mjestu.</p></div><button className="button button-primary" onClick={() => { setError(""); setShowNew(true); }}><FiPlus/> Novi reseller</button></div>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {message && <p className="notice" role="status">{message}</p>}
    <div className="list-toolbar"><div className="search-field"><FiSearch/><input aria-label="Pretraži resellere" placeholder="Pretraži po imenu, e-mailu ili telefonu…" value={search} onChange={event => setSearch(event.target.value)}/></div><span className="muted">{visible.length} od {resellers.length}</span></div>
    <div className="surface reseller-list">
      {loading ? <p className="empty-state" role="status">Učitavanje resellera…</p> : visible.length ? visible.map(item => <button key={item.id} className="reseller-row" onClick={() => setSelected(item)} aria-label={`Prikaži detalje: ${formatName(item.name)}`}><span className="avatar">{item.name.slice(0, 1).toLocaleUpperCase("hr")}</span><span className="reseller-name"><strong>{formatName(item.name)}</strong><small>{item.email || "Bez e-maila"}</small></span><span className="reseller-phone">{item.phone || "Bez telefona"}</span><span className="row-detail">Detalji <FiChevronRight/></span></button>) : <div className="empty-state">{error ? <button className="button" onClick={fetchResellers}>Pokušaj ponovno</button> : search ? "Nema resellera koji odgovaraju pretrazi." : "Još nema resellera. Dodajte prvog ili uvezite profile iz uplata."}</div>}
    </div>
    <details className="maintenance-tools"><summary>Alati za postojeće uplate</summary><p className="muted">Dodajte profile koji nedostaju. Postojeći profili, kontakti, uplate i krediti ostaju sačuvani.</p><button className="button" disabled={importing || loading} onClick={handleImport}>{importing ? "Dodavanje…" : "Dodaj nedostajuće profile iz uplata"}</button></details>
    {selected && <SidePanel title={formatName(selected.name)} onClose={() => setSelected(null)}><ResellerDetails reseller={selected}/><details className="maintenance-tools"><summary>Upravljanje profilom</summary><p className="muted">Brisanje profila ne briše njegove uplate ili kreditne transakcije.</p><button className="button button-danger" onClick={event => handleDelete(selected.id!, event)}>Obriši profil</button></details></SidePanel>}
    {showNew && <SidePanel title="Novi reseller" onClose={() => { if (!saving) setShowNew(false); }}><form onSubmit={handleAddReseller} className="stack-form">{error && <p className="notice notice-error" role="alert">{error}</p>}<fieldset className="form-fields" disabled={saving}><label htmlFor="reseller-name">Ime resellera</label><input id="reseller-name" required value={newName} onChange={event => setNewName(event.target.value)}/><label htmlFor="reseller-email">E-mail <span className="muted">(neobavezno)</span></label><input id="reseller-email" type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)}/><label htmlFor="reseller-phone">Telefon <span className="muted">(neobavezno)</span></label><input id="reseller-phone" type="tel" value={newPhone} onChange={event => setNewPhone(event.target.value)}/><label htmlFor="reseller-notes">Bilješke</label><textarea id="reseller-notes" rows={4} value={newNotes} onChange={event => setNewNotes(event.target.value)}/><button className="button button-primary" type="submit">{saving ? "Spremanje…" : "Spremi resellera"}</button></fieldset></form></SidePanel>}
  </section>;
}
