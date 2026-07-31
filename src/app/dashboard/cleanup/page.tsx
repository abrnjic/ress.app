"use client";

import { useState, useEffect } from "react";
import { getDocs, collection, doc, writeBatch, deleteDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function similar(a: string, b: string) {
  if (a.length === 0) return b.length === 0 ? 1.0 : 0.0;
  if (b.length === 0) return 0.0;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  const distance = matrix[b.length][a.length];
  const maxLength = Math.max(a.length, b.length);
  return (maxLength - distance) / maxLength;
}

export default function CleanupPage() {
  const [groups, setGroups] = useState<string[][]>([]);
  const [allNames, setAllNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  // selections[groupIndex][wrongName] = correctName
  const [selections, setSelections] = useState<Record<number, Record<string, string>>>({});
  const [logs, setLogs] = useState<string[]>([]);
  
  // Manual merge state
  const [manualWrong, setManualWrong] = useState("");
  const [manualCorrect, setManualCorrect] = useState("");

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  const loadAllNames = async () => {
    try {
      const paymentsSnapshot = await getDocs(collection(db, "payments"));
      const resellersSet = new Set<string>();
      paymentsSnapshot.forEach((document) => {
        const name = document.data().resellerName;
        if (name) resellersSet.add(name);
      });
      setAllNames(Array.from(resellersSet).sort());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAllNames();
  }, []);

  const runAnalysis = async () => {
    setLoading(true);
    setLogs([]);
    try {
      await loadAllNames();
      
      const newGroups: string[][] = [];
      const used = new Set<string>();

      for (let i = 0; i < allNames.length; i++) {
        const r1 = allNames[i];
        if (used.has(r1)) continue;
        
        const currentGroup = [r1];
        used.add(r1);
        const r1_lower = r1.toLowerCase();
        
        for (let j = i + 1; j < allNames.length; j++) {
          const r2 = allNames[j];
          if (used.has(r2)) continue;
          
          const r2_lower = r2.toLowerCase();
          const sim = similar(r1_lower, r2_lower);
          
          if (sim > 0.8 || (r1_lower.includes(r2_lower) || r2_lower.includes(r1_lower)) && Math.abs(r1.length - r2.length) < 6) {
            currentGroup.push(r2);
            used.add(r2);
          }
        }
        
        if (currentGroup.length > 1) {
          newGroups.push(currentGroup);
        }
      }
      
      setGroups(newGroups);
      setSelections({});
    } catch (err: any) {
      console.error(err);
      alert("Greška: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelection = (groupIndex: number, originalName: string, targetName: string) => {
    setSelections(prev => {
      const groupSelections = { ...(prev[groupIndex] || {}) };
      if (targetName === "KEEP") {
        delete groupSelections[originalName];
      } else {
        groupSelections[originalName] = targetName;
      }
      return {
        ...prev,
        [groupIndex]: groupSelections
      };
    });
  };

  const executeMerge = async (mappingsToApply: Record<string, string>) => {
    if (Object.keys(mappingsToApply).length === 0) {
      alert("Niste označili nijedno ime za spajanje!");
      return;
    }

    setLoading(true);
    setLogs([]);
    addLog("Započinjem spajanje...");

    try {
      const paymentsSnapshot = await getDocs(collection(db, "payments"));
      let batch = writeBatch(db);
      let count = 0;

      paymentsSnapshot.forEach((document) => {
        const data = document.data();
        const currentName = data.resellerName;
        const key = currentName ? currentName.toLowerCase() : "";
        
        if (mappingsToApply[key]) {
          const newName = mappingsToApply[key];
          batch.update(doc(db, "payments", document.id), { resellerName: newName });
          count++;
          
          if (count % 400 === 0) {
            batch.commit();
            batch = writeBatch(db);
          }
        }
      });

      if (count % 400 !== 0) {
        await batch.commit();
      }
      
      addLog(`Uspješno ažurirano ${count} uplata.`);
      
      addLog("Započinjem brisanje pogrešnih imena iz liste resellera...");
      const resellersSnapshot = await getDocs(collection(db, "resellers"));
      const resellersToDelete: string[] = [];
      const existingNames = new Set<string>();
      
      resellersSnapshot.forEach(d => existingNames.add(d.data().name));
      
      for (const docSnapshot of resellersSnapshot.docs) {
        const name = docSnapshot.data().name;
        const key = name ? name.toLowerCase() : "";
        if (mappingsToApply[key]) {
          resellersToDelete.push(docSnapshot.id);
        }
      }
      
      for (const id of resellersToDelete) {
        await deleteDoc(doc(db, "resellers", id));
      }
      addLog(`Obrisano ${resellersToDelete.length} neispravnih resellera.`);
      
      // Osiguraj da ispravna imena postoje u kolekciji
      addLog("Provjeravam postoje li odabrana ispravna imena u bazi...");
      const correctNames = Array.from(new Set(Object.values(mappingsToApply)));
      for (const correctName of correctNames) {
        if (!existingNames.has(correctName)) {
          await setDoc(doc(collection(db, "resellers")), {
            name: correctName,
            createdAt: new Date().toISOString()
          });
          addLog(`Kreiran reseller: ${correctName}`);
        }
      }
      
      addLog("ČIŠĆENJE ZAVRŠENO! Osvježite analizu da vidite novo stanje.");
      setGroups([]); // Clear groups to force a re-analysis
      await loadAllNames();
      setManualWrong("");
      setManualCorrect("");
    } catch (err: any) {
      addLog(`GREŠKA: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const processGroupMerge = async () => {
    const mappingsToApply: Record<string, string> = {};
    Object.values(selections).forEach(groupSelections => {
      Object.entries(groupSelections).forEach(([wrongName, correctName]) => {
        mappingsToApply[wrongName.toLowerCase()] = correctName;
      });
    });
    await executeMerge(mappingsToApply);
  };

  const processManualMerge = async () => {
    if (!manualWrong || !manualCorrect) {
      alert("Molimo odaberite oba imena.");
      return;
    }
    if (manualWrong === manualCorrect) {
      alert("Odabrali ste isto ime s obje strane!");
      return;
    }
    if (!confirm(`Jeste li sigurni da želite sve uplate s imena "${manualWrong}" prebaciti na "${manualCorrect}"?`)) return;
    
    const mappingsToApply: Record<string, string> = {};
    mappingsToApply[manualWrong.toLowerCase()] = manualCorrect;
    await executeMerge(mappingsToApply);
  };

  return (
    <div style={{ padding: '2rem', background: 'var(--bg-card)', borderRadius: '8px', maxWidth: '800px', margin: '2rem auto' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Alati za čišćenje i spajanje duplikata</h2>
      
      {/* 1. MANUAL MERGE SECTION */}
      <div style={{ marginBottom: '3rem', padding: '1.5rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', borderLeft: '4px solid var(--accent)' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Ručno spajanje 1 na 1 (za sve resellere)</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Ako moj algoritam nije prepoznao neka imena kao slična, ovdje ih možete ručno spojiti.
        </p>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Pogrešno ime:</label>
            <select value={manualWrong} onChange={e => setManualWrong(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <option value="">-- Odaberite neispravno ime --</option>
              {allNames.map((name, i) => <option key={i} value={name}>{name}</option>)}
            </select>
          </div>
          <strong style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>➔</strong>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Pravilno ime:</label>
            <select value={manualCorrect} onChange={e => setManualCorrect(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <option value="">-- Odaberite ispravno ime --</option>
              {allNames.map((name, i) => <option key={i} value={name}>{name}</option>)}
            </select>
          </div>
          <button 
            onClick={processManualMerge}
            disabled={loading || !manualWrong || !manualCorrect}
            style={{ padding: '0.5rem 1.5rem', height: 'fit-content', alignSelf: 'flex-end', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: (loading || !manualWrong || !manualCorrect) ? 'not-allowed' : 'pointer' }}
          >
            Spoji ova dva
          </button>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2rem 0' }} />

      {/* 2. AUTOMATIC ALGORITHM SECTION */}
      <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Automatski pronalazak sličnih (Algoritam)</h3>
      <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
        Kliknite na gumb ispod kako bi sustav sam pokušao pronaći grupe sličnih imena.
      </p>
      
      <button 
        onClick={runAnalysis} 
        disabled={loading}
        style={{ padding: '1rem 2rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '2rem' }}
      >
        {loading ? 'Analiziram bazu...' : 'Analiziraj bazu (Traži sličnosti)'}
      </button>

      {groups.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
            Detaljna obrada po grupama:
          </h3>
          
          {groups.map((group, i) => (
            <div key={i} style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'var(--bg-primary)', borderRadius: '8px', borderLeft: '4px solid var(--accent)' }}>
              <strong style={{ display: 'block', marginBottom: '1rem' }}>Grupa {i + 1}</strong>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {group.map((name, j) => {
                  const currentSelection = (selections[i] && selections[i][name]) || "KEEP";
                  return (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <span style={{ minWidth: '200px', fontWeight: currentSelection === "KEEP" ? 'bold' : 'normal', color: currentSelection === "KEEP" ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {name}
                      </span>
                      <select 
                        value={currentSelection}
                        onChange={(e) => handleSelection(i, name, e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', flex: 1, maxWidth: '300px' }}
                      >
                        <option value="KEEP">-- Zadrži ovo ime (Ispravno) --</option>
                        {group.map((otherName, k) => {
                          if (name === otherName) return null;
                          return <option key={k} value={otherName}>Spoji s: {otherName}</option>;
                        })}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <button 
            onClick={processGroupMerge}
            disabled={loading}
            style={{ padding: '1rem 2rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', width: '100%', marginTop: '1rem', fontSize: '1.1rem' }}
          >
            {loading ? 'Spajanje u tijeku...' : 'Potvrdi i spoji odabrane grupe'}
          </button>
        </div>
      )}

      {logs.length > 0 && (
        <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '8px', fontFamily: 'monospace' }}>
          {logs.map((log, i) => (
            <div key={i} style={{ marginBottom: '0.5rem' }}>{log}</div>
          ))}
        </div>
      )}
    </div>
  );
}
