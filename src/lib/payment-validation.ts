// Validation applies to new entries only. Historical records are never rewritten.
export function monthOfDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function defaultPaymentDate(month: string, today = new Date()): Date {
  if (monthOfDate(today) === month) return today;
  const [year, number] = month.split("-").map(Number);
  return new Date(year, number - 1, 1, 12);
}

export function validateNewPayment(name: string, amount: number, date: Date | null, month: string): string {
  if (!name.trim()) return "Odaberite resellera ili unesite njegovo ime.";
  if (!Number.isFinite(amount) || amount <= 0) return "Unesite iznos veći od nule.";
  if (!date || !Number.isFinite(date.getTime())) return "Odaberite valjan datum uplate.";
  if (monthOfDate(date) !== month) return "Datum uplate mora biti unutar odabranog mjeseca. Promijenite datum ili mjesec pregleda.";
  return "";
}
