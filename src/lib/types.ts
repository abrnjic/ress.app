export interface Payment {
  id?: string;
  resellerName: string;
  amount: number;
  currency: string;
  date: string; // ISO string for the actual payment date
  monthYear: string; // YYYY-MM format for grouping and closing
  createdAt?: string;
}

export interface MonthStatus {
  id: string; // YYYY-MM
  isClosed: boolean;
  closedAt?: string;
}

export interface Reseller {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  createdAt?: string;
}

export function formatName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

export interface CreditTransaction {
  id?: string;
  resellerName: string;
  type: 'allocation' | 'repayment';
  payerName?: string;
  amount: number;
  date: string; // ISO string
  notes?: string;
  createdAt?: string;
}
