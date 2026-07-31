"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { FiLock, FiMail, FiArrowRight } from "react-icons/fi";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (email !== "abrnjic@gmail.com") {
      setError("Neovlašten pristup. Vaš email nema ovlasti.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError("Prijava nije uspjela. Provjerite podatke.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '3rem 2rem',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        
        <div style={{ 
          background: 'var(--accent)', 
          width: '64px', 
          height: '64px', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: '1.5rem',
          boxShadow: '0 10px 25px rgba(59, 130, 246, 0.5)'
        }}>
          <FiLock size={28} color="white" />
        </div>

        <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>Dobrodošli natrag</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', textAlign: 'center' }}>Prijavite se kako biste pristupili nadzornoj ploči za resellere.</p>

        {error && (
          <div style={{ 
            width: '100%', 
            background: 'rgba(239, 68, 68, 0.1)', 
            color: '#fca5a5', 
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1.5rem', 
            textAlign: 'center',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <FiMail size={18} />
            </div>
            <input 
              type="email" 
              placeholder="Email adresa"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ 
                width: '100%', 
                padding: '1rem 1rem 1rem 3rem', 
                borderRadius: '12px', 
                border: '1px solid rgba(255, 255, 255, 0.1)', 
                background: 'rgba(15, 23, 42, 0.6)', 
                color: 'white',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <FiLock size={18} />
            </div>
            <input 
              type="password" 
              placeholder="Lozinka"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ 
                width: '100%', 
                padding: '1rem 1rem 1rem 3rem', 
                borderRadius: '12px', 
                border: '1px solid rgba(255, 255, 255, 0.1)', 
                background: 'rgba(15, 23, 42, 0.6)', 
                color: 'white',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%',
              padding: '1rem', 
              borderRadius: '12px', 
              border: 'none', 
              background: 'var(--accent)', 
              color: 'white', 
              fontWeight: 'bold', 
              fontSize: '1rem',
              marginTop: '0.5rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'background 0.2s, transform 0.1s'
            }}
            onMouseOver={(e) => { if(!loading) e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseOut={(e) => { if(!loading) e.currentTarget.style.background = 'var(--accent)' }}
            onMouseDown={(e) => { if(!loading) e.currentTarget.style.transform = 'scale(0.98)' }}
            onMouseUp={(e) => { if(!loading) e.currentTarget.style.transform = 'scale(1)' }}
          >
            {loading ? 'Prijavljivanje...' : 'Prijava'}
            {!loading && <FiArrowRight />}
          </button>
        </form>
      </div>
    </div>
  );
}
