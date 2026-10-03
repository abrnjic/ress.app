import { Payment, formatName } from '@/lib/types';

export function buildReport(payments: Payment[], period: string, now = new Date()) {
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthKey = (offset: number) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };
  const valid = payments.filter(p => /^\d{4}-(0[1-9]|1[0-2])$/.test(p.monthYear) && Number.isFinite(p.amount));
  const selected = valid.filter(p => period === 'All' || (period === '12' ? p.monthYear >= monthKey(-11) && p.monthYear <= currentMonth : p.monthYear.startsWith(`${period}-`)));
  const totals = new Map<string, number>();
  valid.forEach(p => totals.set(p.monthYear, (totals.get(p.monthYear) || 0) + p.amount));
  const keys = selected.map(p => p.monthYear).sort();
  const first = period === '12' ? monthKey(-11) : period === 'All' ? keys[0] : `${period}-01`;
  const last = period === '12' ? currentMonth : period === 'All' ? keys.at(-1) : period === String(now.getFullYear()) ? currentMonth : `${period}-12`;
  const months: { key: string; amount: number }[] = [];
  if (first && last) {
    const cursor = new Date(Number(first.slice(0, 4)), Number(first.slice(5)) - 1, 1);
    while (true) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      if (key > last) break;
      months.push({ key, amount: totals.get(key) || 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  const resellerTotals = new Map<string, { name: string; amount: number; count: number }>();
  selected.forEach(p => {
    const name = formatName(p.resellerName.trim().replace(/\s+/g, ' ')) || 'Bez naziva';
    const key = name.toLocaleLowerCase('hr');
    const entry = resellerTotals.get(key) || { name, amount: 0, count: 0 };
    resellerTotals.set(key, { ...entry, amount: entry.amount + p.amount, count: entry.count + 1 });
  });
  const total = selected.reduce((sum, p) => sum + p.amount, 0);
  const completed = months.filter(m => m.key < currentMonth);
  const recent = completed.at(-1);
  const previous = completed.at(-2);
  const trend = recent && previous && previous.amount > 0 ? (recent.amount - previous.amount) / previous.amount * 100 : null;
  const forecastKeys = [-3, -2, -1].map(monthKey);
  const hasForecast = valid.some(p => p.monthYear <= forecastKeys[0]);
  const forecast = hasForecast ? forecastKeys.reduce((sum, key) => sum + (totals.get(key) || 0), 0) / 3 : null;
  const annual = new Map<string, number>();
  valid.forEach(p => annual.set(p.monthYear.slice(0, 4), (annual.get(p.monthYear.slice(0, 4)) || 0) + p.amount));
  return {
    total, count: selected.length, average: selected.length ? total / selected.length : 0,
    resellerCount: resellerTotals.size, months, recent, previous, trend, forecast, forecastKeys,
    top: [...resellerTotals.values()].sort((a, b) => b.amount - a.amount).slice(0, 10),
    years: [...annual.keys()].sort().reverse(),
    annual: [...annual.entries()].sort().map(([year, amount]) => ({ year, amount })),
    excluded: payments.length - valid.length,
  };
}
