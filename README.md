# Reseller CRM Dashboard 📈

Profesionalna web aplikacija izgrađena za praćenje, upravljanje i analitiku resellera i njihovih uplata. Aplikacija pruža napredni nadzor performansi, brzu administraciju te generiranje izvještaja.

## 🌟 Ključne značajke

- **Upravljanje Resellerima:** Brzi pregled svih klijenata (resellera), njihovih detaljnih profila i ukupne vrijednosti (LTV).
- **Evidencija Uplata:** Brzo dodavanje i praćenje uplata s ugrađenim pametnim pretraživačem i filtriranjem.
- **Napredna Analitika:** Interaktivni grafikoni za vizualizaciju rasta prihoda i mjesečnih kretanja.
- **Generiranje Izvještaja:** Eksportiranje mjesečnih podataka u profesionalne PDF i Excel dokumente jednim klikom.
- **Pametno Pretraživanje:** Podržava neosjetljivost na velika i mala slova, kao i standardizaciju hrvatskih znakova (č, ć, š, ž, đ) te formatirane iznose uplata (npr. 300,00).
- **Tematski Dizajn:** Moderni premium korisničko sučelje (UI) s Glassmorphism dizajnom i podrškom za Svijetlu i Tamnu temu (Light/Dark mode).
- **Responzivnost:** Potpuno prilagođeno za računala, tablete i mobilne telefone s glatkim animacijama.
- **Sigurnost:** Firebase Authentication sa zaštićenim rutama.

## 🛠️ Tehnologije

- **Frontend:** Next.js (React), TypeScript
- **Dizajn/Stiliziranje:** Vanilla CSS (Glassmorphism, CSS Varijable)
- **Baza podataka i Auth:** Firebase Firestore & Firebase Authentication
- **Grafikoni:** Recharts
- **Izvještaji:** jsPDF (za PDF) i XLSX (za Excel)
- **Ikone:** React Icons (Feather Icons)
- **Animacije i efekti:** Canvas Confetti

## 🚀 Pokretanje projekta (Lokalno)

Za pokretanje ovog projekta na svom računalu trebat ćete Node.js instaliran na sustavu.

1. **Instalacija paketa:**
   ```bash
   npm install
   ```

2. **Pokretanje razvojnog (Dev) servera:**
   ```bash
   npm run dev
   ```

3. **Otvaranje u pregledniku:**
   Otvorite [http://localhost:3000](http://localhost:3000) u svom omiljenom pregledniku.

## 🌐 Postavljanje na internet (Deployment)

Aplikacija je optimizirana za postavljanje putem Vercela.
Za objavu aplikacije uživo jednostavno koristite naredbu:
```bash
npx vercel --prod
```

## 🔐 Konfiguracija (Firebase)
Aplikacija zahtijeva ispravnu konfiguraciju Firebase projekta. Potrebno je postaviti `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` i ostale standardne Firebase varijable unutar vaše `.env.local` datoteke te postaviti Firestore pravila za čitanje/pisanje.

---
Dizajnirano i izrađeno za vrhunsko korisničko iskustvo.
