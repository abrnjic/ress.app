"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiCreditCard, FiLogOut, FiMoon, FiPieChart, FiSun, FiUsers, FiGrid } from "react-icons/fi";
import { useEffect, useState } from "react";

const navigation = [
  { name: "Uplate", href: "/dashboard", icon: FiGrid },
  { name: "Reselleri", href: "/dashboard/resellers", icon: FiUsers },
  { name: "Krediti", href: "/dashboard/credits", icon: FiCreditCard },
  { name: "Izvještaji", href: "/dashboard/analytics", icon: FiPieChart },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState("dark");
  const [error, setError] = useState("");
  useEffect(() => {
    const saved = localStorage.getItem("app-theme") === "light" ? "light" : "dark";
    // Read the saved preference only after the client mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("app-theme", next);
    document.documentElement.dataset.theme = next;
  }
  return <ProtectedRoute>
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link href="/dashboard" className="brand"><span className="brand-mark">R</span><span>Reselleri<small>Uplate i poslovanje</small></span></Link>
        <nav aria-label="Glavna navigacija" className="workspace-nav">
          {navigation.map(({ name, href, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
            return <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}><Icon size={19}/><span>{name}</span></Link>;
          })}
        </nav>
        <p className="sidebar-footnote">Sve na jednom mjestu.</p>
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <span className="muted">Pregled poslovanja</span>
          <div className="toolbar-actions">
            <button className="button button-icon" onClick={toggleTheme} aria-label={theme === "dark" ? "Uključi svijetlu temu" : "Uključi tamnu temu"}>{theme === "dark" ? <FiSun/> : <FiMoon/>}</button>
            <button className="button button-quiet" onClick={async () => { try { await signOut(auth); } catch { setError("Odjava nije uspjela. Pokušajte ponovno."); } }}><FiLogOut/> Odjava</button>
          </div>
        </header>
        <main className="workspace-main">{error && <p className="notice notice-error" role="alert">{error}</p>}{children}</main>
      </div>
    </div>
  </ProtectedRoute>;
}
