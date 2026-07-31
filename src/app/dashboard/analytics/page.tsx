"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Payment, formatName, formatCurrency } from "@/lib/types";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format } from "date-fns";
import { hr } from "date-fns/locale/hr";

export default function AnalyticsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [resellerCount, setResellerCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>("All");

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, "payments"));
        const fetched: Payment[] = [];
        snapshot.forEach(doc => {
          fetched.push({ id: doc.id, ...doc.data() } as Payment);
        });
        setPayments(fetched);
        
        const resellersSnap = await getDocs(collection(db, "resellers"));
        setResellerCount(resellersSnap.size);
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  const years = Array.from(new Set(payments.map(p => p.monthYear.split("-")[0]))).sort().reverse();
  
  const filteredPayments = selectedYear === "All" 
    ? payments 
    : payments.filter(p => p.monthYear.startsWith(selectedYear));

  const totalRevenue = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  // Predictive Revenue Logic
  const averagePayment = payments.length > 0 ? payments.reduce((sum, p) => sum + p.amount, 0) / payments.length : 0;
  const expectedNextMonthRevenue = resellerCount * averagePayment;

  // Group by month
  const byMonth = filteredPayments.reduce((acc, p) => {
    acc[p.monthYear] = (acc[p.monthYear] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);
  
  const sortedMonths = Object.keys(byMonth).sort(); // Sort ascending for charts

  const monthChartData = sortedMonths.map(month => {
    // Format "YYYY-MM" to something like "Srp 2026"
    const dateObj = new Date(month + "-01");
    const label = !isNaN(dateObj.getTime()) 
      ? format(dateObj, "MMM yyyy", { locale: hr }).replace(/^\w/, c => c.toUpperCase())
      : month;
      
    return {
      name: label,
      Iznos: byMonth[month]
    };
  });

  // Trend math for the latest month vs previous month
  let trendPercentage = 0;
  let hasTrend = false;
  if (sortedMonths.length >= 2) {
    const currentMonthAmount = byMonth[sortedMonths[sortedMonths.length - 1]];
    const prevMonthAmount = byMonth[sortedMonths[sortedMonths.length - 2]];
    if (prevMonthAmount > 0) {
      trendPercentage = ((currentMonthAmount - prevMonthAmount) / prevMonthAmount) * 100;
      hasTrend = true;
    }
  }

  // Group by year for yearly chart
  const byYear = payments.reduce((acc, p) => {
    const y = p.monthYear.split("-")[0];
    acc[y] = (acc[y] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);
  const yearChartData = Object.keys(byYear).sort().map(y => ({
    name: y,
    Iznos: byYear[y]
  }));

  // Group by reseller
  const byReseller = filteredPayments.reduce((acc, p) => {
    const name = formatName(p.resellerName);
    acc[name] = (acc[name] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);
  
  const sortedResellers = Object.entries(byReseller)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10 for chart

  const resellerChartData = sortedResellers.map(([name, amount]) => ({
    name,
    Iznos: amount
  }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass" style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <p style={{ margin: 0, fontWeight: '700', color: 'var(--text-primary)' }}>{label}</p>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--accent)', fontWeight: '600' }}>
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: '800', letterSpacing: '-0.025em' }}>Pametna Analitika</h1>
        <select 
          value={selectedYear} 
          onChange={(e) => setSelectedYear(e.target.value)}
          style={{ padding: '0.75rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', cursor: 'pointer', fontWeight: '600', outline: 'none' }}
        >
          <option value="All">Cijelo vrijeme</option>
          {years.map(y => <option key={y} value={y}>{y}.</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Učitavanje analitike...</div>
      ) : (
        <>
          {/* Main KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
            
            <div className="glass" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
                Ukupna uplata ({selectedYear === 'All' ? 'Sveukupno' : selectedYear + '.'})
              </h2>
              <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
                {formatCurrency(totalRevenue)}
              </div>
            </div>

            {selectedYear === 'All' && (
              <div className="glass" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--accent)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--accent)', color: 'white', padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 'bold', borderBottomLeftRadius: '12px' }}>AI Predviđanje</div>
                <h2 style={{ fontSize: '0.95rem', color: 'var(--accent)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
                  Očekivani prihod (Sljedeći mjesec)
                </h2>
                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
                  {formatCurrency(expectedNextMonthRevenue)}
                </div>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Baza: {resellerCount} aktivnih klijenata × {formatCurrency(averagePayment)} prosjek</p>
              </div>
            )}

            {hasTrend && selectedYear === 'All' && (
              <div className="glass" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
                  Trend ({sortedMonths[sortedMonths.length - 1]} vs {sortedMonths[sortedMonths.length - 2]})
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: '800', color: trendPercentage >= 0 ? 'var(--success)' : 'var(--danger)', letterSpacing: '-0.025em' }}>
                    {trendPercentage > 0 ? '+' : ''}{trendPercentage.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '1.5rem', color: trendPercentage >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {trendPercentage >= 0 ? '↗' : '↘'}
                  </div>
                </div>
              </div>
            )}
            
            <div className="glass" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
                Ukupno ugovora (Uplata)
              </h2>
              <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
                {filteredPayments.length}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '2rem' }}>
            {/* Monthly Trend Chart */}
            <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Zarada po mjesecima (Trend)</h3>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                  <LineChart data={monthChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickMargin={10} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickFormatter={(val) => `${val} €`} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="Iznos" stroke="var(--accent)" strokeWidth={3} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
            {/* Top Resellers Bar Chart */}
            <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Top 10 Resellera ({selectedYear === 'All' ? 'Sveukupno' : selectedYear + '.'})</h3>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                  <BarChart data={resellerChartData} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={true} vertical={false} />
                    <XAxis type="number" stroke="var(--text-secondary)" fontSize={12} tickFormatter={(val) => `${val} €`} />
                    <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" fontSize={12} width={100} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
                    <Bar dataKey="Iznos" fill="var(--accent)" radius={[0, 4, 4, 0]}>
                      {resellerChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Yearly Trend Bar Chart (Always shows all years for context) */}
            <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Zarada po godinama (Usporedba)</h3>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                  <BarChart data={yearChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickMargin={10} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickFormatter={(val) => `${val} €`} width={80} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
                    <Bar dataKey="Iznos" fill="var(--success)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
