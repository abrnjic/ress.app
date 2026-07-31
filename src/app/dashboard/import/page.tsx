"use client";

import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function ImportPage() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");

  const handleImport = async () => {
    if (!confirm("Are you sure you want to import data? This might add duplicates if run multiple times.")) return;
    
    setLoading(true);
    try {
      setProgress("Fetching data...");
      const res = await fetch("/parsed_data.json");
      const records = await res.json();
      
      setProgress(`Starting import of ${records.length} records...`);
      
      const batchSize = 100;
      let importedCount = 0;
      
      // Note: For a production app we'd use Firestore batches, but for a one-off run 
      // simple loop with addDoc is sufficient for 1327 records, although slower.
      // We will do simple iteration
      for (const record of records) {
        // Just add an ISO date timestamp for createdAt
        record.createdAt = new Date().toISOString();
        // Since dates are mostly raw strings, we just leave them. The app relies on monthYear.
        await addDoc(collection(db, "payments"), record);
        importedCount++;
        if (importedCount % batchSize === 0) {
          setProgress(`Imported ${importedCount} / ${records.length} records...`);
        }
      }
      
      setProgress(`Successfully imported all ${records.length} records!`);
    } catch (error) {
      console.error(error);
      setProgress("Error occurred during import. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '8px' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Data Migration</h1>
      <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
        Click the button below to import the parsed historical data into Firestore.
      </p>
      
      <button 
        onClick={handleImport} 
        disabled={loading}
        style={{ 
          padding: '0.75rem 1.5rem', 
          background: 'var(--accent)', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px',
          fontWeight: 'bold',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Importing...' : 'Start Import'}
      </button>

      {progress && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '4px', border: '1px solid var(--border)' }}>
          {progress}
        </div>
      )}
    </div>
  );
}
