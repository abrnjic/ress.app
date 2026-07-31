"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiHome, FiPieChart, FiLogOut, FiUsers, FiSun, FiMoon } from "react-icons/fi";
import { useState, useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("app-theme") || "dark";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("app-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const navItems = [
    { name: "Nadzorna ploča", href: "/dashboard", icon: FiHome },
    { name: "Analitika", href: "/dashboard/analytics", icon: FiPieChart },
    { name: "Moji Reselleri", href: "/dashboard/resellers", icon: FiUsers },
  ];

  return (
    <ProtectedRoute>
      <div className="dashboard-layout">
        {/* Sidebar */}
        <aside className="glass sidebar">
          <div className="sidebar-header">
            CRM <span style={{ color: 'var(--text-primary)' }}>Reselleri</span>
          </div>
          <nav className="sidebar-nav">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link 
                  key={item.name} 
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.875rem 1.5rem',
                    margin: '0 1rem',
                    borderRadius: '12px',
                    color: isActive ? 'white' : 'var(--text-secondary)',
                    background: isActive ? 'linear-gradient(135deg, var(--accent), var(--accent-hover))' : 'transparent',
                    boxShadow: isActive ? '0 4px 12px var(--accent-glow)' : 'none',
                    fontWeight: isActive ? '600' : '500',
                    gap: '1rem',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--bg-hover)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  <Icon size={20} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>
          
        <main className="main-content">
          {/* Top Bar */}
          <header className="glass top-bar">
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: '600' }}>Dobrodošli nazad, <span style={{ color: 'var(--accent)' }}>Admin</span></h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <button 
                onClick={toggleTheme}
                title="Promijeni temu"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'rotate(15deg)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'rotate(0deg)'}
              >
                {theme === "dark" ? <FiSun size={20} /> : <FiMoon size={20} />}
              </button>
              
              <button 
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 1.2rem',
                  background: 'linear-gradient(135deg, var(--danger), var(--danger-hover))',
                  border: 'none',
                  color: 'white',
                  fontWeight: '600',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                }}
              >
                <FiLogOut size={18} />
                Odjava
              </button>
            </div>
          </header>

          <div className="main-scroll-area">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
