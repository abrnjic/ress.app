"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Payment, formatCurrency } from '@/lib/types';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { buildReport } from './report-data';
import styles from './analytics.module.css';

const monthLabel = (key: string) => new Intl.DateTimeFormat('hr-HR', { month: 'short', year: 'numeric' }).format(new Date(Number(key.slice(0, 4)), Number(key.slice(5)) - 1, 1));
const compactEuro = (value: number) => new Intl.NumberFormat('hr-HR', { notation: 'compact', maximumFractionDigits: 1 }).format(value) + ' €';

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: readonly { value?: number | string }[]; label?: string | number }) {
  return active && payload?.length ? <div className={styles.tooltip}>{label}<strong>{formatCurrency(Number(payload[0].value) || 0)}</strong></div> : null;
}

export default function AnalyticsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('All');
  const fetchData = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, 'payments'));
      setPayments(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payment)));
    } catch {
      setError('Izvještaj se nije učitao. Pokušaj ponovno.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    getDocs(collection(db, 'payments')).then(snapshot => {
      if (!cancelled) setPayments(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payment)));
    }).catch(() => {
      if (!cancelled) setError('Izvještaj se nije učitao. Pokušaj ponovno.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const report = useMemo(() => buildReport(payments, period), [payments, period]);
  const monthData = report.months.map(m => ({ name: monthLabel(m.key), amount: m.amount }));
  const periodLabel = period === 'All' ? 'Cijelo vrijeme' : period === '12' ? 'Posljednjih 12 mjeseci' : `${period}. godina`;
  const currentYear = String(new Date().getFullYear());
  const years = [...new Set([currentYear, ...report.years])].sort().reverse();

  return <div className={`${styles.page} animate-fade-in`}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>Izvještaji</span><h1>Pametna analitika</h1><p className={styles.subtle}>Uplate, trendovi i reselleri — jasan pregled poslovanja.</p></div>
      <div className={styles.controls} aria-label="Razdoblje izvještaja">
        <button aria-pressed={period === 'All'} onClick={() => setPeriod('All')}>Sve vrijeme</button>
        <button aria-pressed={period === '12'} onClick={() => setPeriod('12')}>12 mjeseci</button>
        <select aria-label="Odaberi godinu izvještaja" value={/^\d{4}$/.test(period) ? period : ''} onChange={e => { if (e.target.value) setPeriod(e.target.value); }}>
          <option value="" disabled>Odaberi godinu</option>{years.map(y => <option key={y} value={y}>{y}.</option>)}
        </select>
      </div>
    </header>
    {loading ? <div className={styles.state} role="status">Učitavanje izvještaja…</div> : error ? <div className={styles.state} role="alert">{error}<br/><button className={styles.retry} onClick={() => { setLoading(true); setError(''); void fetchData(); }}>Pokušaj ponovno</button></div> : <>
      <section className={styles.metrics} aria-label="Pokazatelji za odabrano razdoblje">
        {[{ title: 'Ukupne uplate', value: formatCurrency(report.total), note: periodLabel },
          { title: 'Broj uplata', value: report.count.toLocaleString('hr-HR'), note: 'Evidentirane uplate u razdoblju' },
          { title: 'Prosječna uplata', value: formatCurrency(report.average), note: 'Ukupne uplate ÷ broj uplata' },
          { title: 'Reselleri s uplatama', value: report.resellerCount.toLocaleString('hr-HR'), note: 'Jedinstveni nazivi u razdoblju' }].map(item => <article className={styles.metric} key={item.title}><h2>{item.title}</h2><div className={styles.value}>{item.value}</div><p>{item.note}</p></article>)}
      </section>
      {report.count === 0 ? <div className={styles.state}>Nema evidentiranih uplata za odabrano razdoblje. Odaberi drugu godinu ili sve vrijeme.</div> : <>
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Uplate po mjesecima</h2><p className={styles.subtle}>{periodLabel} · Mjeseci bez uplata prikazani su kao 0 €.</p></div>
            {report.recent && report.previous && <div className={styles.trend}><span className={report.trend !== null && report.trend < 0 ? styles.negative : styles.positive}>{report.trend === null ? 'Bez postotne usporedbe' : `${report.trend > 0 ? '+' : ''}${report.trend.toLocaleString('hr-HR', { maximumFractionDigits: 1 })} %`}</span><div className={styles.note}>{monthLabel(report.recent.key)} / {monthLabel(report.previous.key)}</div></div>}
          </div>
          <div className={styles.chart} role="img" aria-label={`Graf mjesečnih uplata: ${periodLabel}`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthData} margin={{ top: 10, right: 8, bottom: 5, left: 0 }}>
            <defs><linearGradient id="reportRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={.3}/><stop offset="100%" stopColor="var(--accent)" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 5" stroke="var(--border)" vertical={false}/><XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28}/><YAxis tickFormatter={compactEuro} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={65}/><Tooltip content={<ChartTooltip/>}/><Area type="linear" dataKey="amount" stroke="var(--accent)" strokeWidth={2.5} fill="url(#reportRevenue)" isAnimationActive={false}/>
          </AreaChart></ResponsiveContainer></div>
          <p className={styles.note}>Trend uspoređuje posljednja dva završena kalendarska mjeseca u razdoblju. Tekući mjesec još traje i izostavljen je iz usporedbe.</p>
        </section>
        <div className={styles.columns}>
          <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Top 10 resellera</h2><p className={styles.subtle}>Prema iznosu uplata · {periodLabel.toLocaleLowerCase('hr')}</p></div></div>
            <ol className={styles.ranking}>{report.top.map((r, i) => <li key={r.name}><span className={styles.rank}>{String(i + 1).padStart(2, '0')}</span><div><div className={styles.rankName}><span>{r.name}</span><span className={styles.note}>{r.count} uplata</span></div><div className={styles.track} aria-hidden="true"><div className={styles.fill} style={{ width: `${Math.max(0, Math.min(100, report.top[0].amount > 0 ? r.amount / report.top[0].amount * 100 : 0))}%` }}/></div></div><span className={styles.amount}>{formatCurrency(r.amount)}</span></li>)}</ol>
          </section>
          <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Usporedba godina</h2><p className={styles.subtle}>Sve godine · tekuća godina do sada</p></div></div>
            <div className={styles.chart} role="img" aria-label="Graf ukupnih uplata po godinama"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.annual} margin={{ top: 10, right: 8, bottom: 5, left: 0 }}><CartesianGrid strokeDasharray="3 5" stroke="var(--border)" vertical={false}/><XAxis dataKey="year" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false}/><YAxis tickFormatter={compactEuro} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={65}/><Tooltip content={<ChartTooltip/>} cursor={{ fill: 'var(--bg-hover)' }}/><Bar dataKey="amount" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={42} isAnimationActive={false}/></BarChart></ResponsiveContainer></div>
          </section>
        </div>
      </>}
      <section className={styles.panel}><h2>Orijentacijski mjesečni iznos</h2><p className={styles.subtle}>Prosjek uplata iz posljednja tri završena kalendarska mjeseca, neovisno o filtru.</p><div className={styles.forecast}><div><p>{report.forecastKeys.map(monthLabel).join(' · ')}</p><p className={styles.note}>Računska procjena na temelju povijesti uplata. Buduće uplate mogu se razlikovati.</p></div><strong>{report.forecast === null ? 'Nedovoljno povijesti' : formatCurrency(report.forecast)}</strong></div></section>
      <p className={styles.note}>Iznosi predstavljaju evidentirane uplate, bez obračuna troškova i dobiti. Razdoblje se određuje prema mjesecu kojem je uplata pridružena.{report.excluded > 0 && ` Iz izračuna je izostavljeno ${report.excluded} zapisa s neispravnim mjesecom ili iznosom.`}</p>
    </>}
  </div>;
}
