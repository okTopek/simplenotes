# 📝 SimpleNotes

Aplikacja do notatek typu **offline-first**: backend API, aplikacja webowa (PWA) oraz aplikacja mobilna — wszystkie współdzielą jeden backend i potrafią działać bez połączenia z internetem, synchronizując zmiany po odzyskaniu sieci.

---

## 1. Przegląd projektu

SimpleNotes to monorepo zawierające trzy aplikacje korzystające z jednego REST API:

- **Backend** — FastAPI + PostgreSQL, pełen CRUD na notatkach z miękkim usuwaniem i endpointem synchronizacji.
- **PWA** — React + Vite, działa offline dzięki Service Workerowi i IndexedDB, instalowalna na pulpicie/telefonie.
- **Mobile** — React Native (Expo), nawigacja zakładkowa, aparat, lokalizacja, powiadomienia, pamięć lokalna (AsyncStorage).

### Najważniejsze funkcje

- ✅ **Offline-first** — zapis lokalny, synchronizacja po odzyskaniu sieci
- ✅ **Miękkie usuwanie** (`is_deleted`) zamiast trwałego kasowania
- ✅ **Synchronizacja** przez endpoint `/sync` (strategia *last-write-wins*)
- ✅ **CRUD + wyszukiwanie/filtrowanie** notatek
- ✅ **UUID** jako identyfikatory notatek
- ✅ **Tryb jasny/ciemny** (PWA) i natywny aparat/lokalizacja (mobile)
- ✅ **CI/CD** (GitHub Actions) + **IaC** (Terraform dla Railway)

---

## 2. Stack technologiczny

| Warstwa | Technologia | Dlaczego |
|---|---|---|
| **API** | FastAPI (Python 3.11) | Szybkie, async, automatyczna walidacja (Pydantic) i dokumentacja OpenAPI |
| **Baza** | PostgreSQL 16 | Sprawdzona, relacyjna, dobre wsparcie na Railway |
| **ORM** | SQLAlchemy 2.0 | Standard w Pythonie, łatwa podmiana bazy (SQLite w testach) |
| **Web** | React 18 + Vite | Szybki dev/build, nowoczesny DX |
| **Offline (web)** | Service Worker + IndexedDB | Cache zasobów i lokalne przechowywanie notatek bez zależności |
| **Mobile** | Expo SDK 54 (RN 0.81) | Jeden kod na iOS/Android, łatwy dostęp do natywnych funkcji |
| **Nawigacja** | React Navigation 7 | De facto standard w React Native |
| **Pamięć (mobile)** | AsyncStorage | Prosty, trwały magazyn klucz-wartość |
| **HTTP** | axios | Spójny klient z timeoutami i interceptorami |
| **Konteneryzacja** | Docker + Compose | Powtarzalne środowisko dev i deploy |
| **IaC** | Terraform (provider Railway) | Deklaratywny, wersjonowany opis infrastruktury |
| **CI/CD** | GitHub Actions | Testy, build i skan bezpieczeństwa przy każdym push |

---

## 3. Quick start (lokalnie)

### Wymagania
- Python 3.11, Node.js 20+, Docker (opcjonalnie), Expo Go na telefonie (dla mobile)

### A. Najszybciej — całość przez Docker Compose

```bash
git clone https://github.com/<twoj-user>/simplenotes.git
cd simplenotes
cp .env.example .env          # ustaw POSTGRES_* jeśli chcesz
docker compose up --build     # API na http://localhost:8000
```

Dokumentacja API (Swagger UI): http://localhost:8000/docs

### B. Backend osobno

```bash
cd backend
python -m venv .venv && source .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/simplenotes"
uvicorn main:app --reload     # http://localhost:8000
```

### C. PWA (web)

```bash
cd pwa
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev                   # http://localhost:5173
```

### D. Mobile (Expo)

```bash
cd mobile
npm install
# WAŻNE: na fizycznym telefonie użyj IP komputera w sieci LAN, nie localhost!
echo "EXPO_PUBLIC_API_URL=http://192.168.x.x:8000" > .env
npx expo start -c             # zeskanuj QR w aplikacji Expo Go
```

> ℹ️ Telefon i komputer muszą być w tej samej sieci Wi-Fi, a port 8000 musi być przepuszczony przez firewall. Zobacz [Troubleshooting](#9-troubleshooting).

---

## 4. Architektura (diagram ASCII)

```
                 ┌──────────────────────────────────────────────┐
                 │                  KLIENCI                       │
                 │                                                │
   ┌─────────────┴───────────┐            ┌─────────────────────┐ │
   │   PWA (React + Vite)     │            │  Mobile (Expo / RN) │ │
   │  ┌───────────────────┐   │            │ ┌─────────────────┐ │ │
   │  │ Service Worker    │   │            │ │ AsyncStorage    │ │ │
   │  │ + IndexedDB       │   │            │ │ Camera/Location │ │ │
   │  └───────────────────┘   │            │ └─────────────────┘ │ │
   └─────────────┬───────────┘            └──────────┬──────────┘ │
                 │  HTTPS / JSON (axios)             │            │
                 └──────────────┬───────────────────┘            │
                                ▼                                 │
                 ┌──────────────────────────────┐                │
                 │     Backend API (FastAPI)     │                │
                 │  /  /health  /notes  /sync    │                │
                 │   Pydantic + SQLAlchemy 2.0   │                │
                 └──────────────┬───────────────┘                │
                                ▼                                 │
                 ┌──────────────────────────────┐                │
                 │     PostgreSQL 16  (notes)    │                │
                 └──────────────────────────────┘                │
                 └────────────────────────────────────────────────┘
```

Przepływ offline: klient zapisuje notatkę lokalnie (IndexedDB / AsyncStorage) →
po odzyskaniu sieci wysyła kolejkę zmian do `POST /sync` → backend uzgadnia stan
(strategia *last-write-wins* po `updated_at`).

---

## 5. Endpointy API

Bazowy URL (lokalnie): `http://localhost:8000`

| Metoda | Ścieżka | Opis | Status |
|---|---|---|---|
| `GET` | `/` | Status serwisu | 200 |
| `GET` | `/health` | Health check (sprawdza bazę) | 200 / 503 |
| `GET` | `/notes?skip=0&limit=100` | Lista notatek (paginacja) | 200 |
| `GET` | `/notes/{id}` | Pojedyncza notatka | 200 / 404 |
| `POST` | `/notes` | Utworzenie notatki | 201 |
| `PUT` | `/notes/{id}` | Aktualizacja notatki | 200 / 404 |
| `DELETE` | `/notes/{id}` | Miękkie usunięcie (`is_deleted=true`) | 200 / 404 |
| `POST` | `/sync` | Synchronizacja zmian offline | 200 |

### Przykłady (bash / curl)

```bash
# Utworzenie notatki
curl -X POST http://localhost:8000/notes \
  -H "Content-Type: application/json" \
  -d '{"title": "Zakupy", "content": "Mleko, chleb"}'

# Lista notatek
curl http://localhost:8000/notes?skip=0&limit=20

# Aktualizacja
curl -X PUT http://localhost:8000/notes/<id> \
  -H "Content-Type: application/json" \
  -d '{"title": "Zakupy", "content": "Mleko, chleb, masło"}'

# Miękkie usunięcie
curl -X DELETE http://localhost:8000/notes/<id>

# Synchronizacja offline
curl -X POST http://localhost:8000/sync \
  -H "Content-Type: application/json" \
  -d '{"notes": [{"id": "abc", "title": "x", "content": "y", "updated_at": "2026-06-27T10:00:00Z"}]}'
```

### Przykład (JavaScript / axios)

```javascript
import axios from "axios";
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

const { data } = await api.post("/notes", { title: "Pomysł", content: "..." });
console.log(data.id);
```

### Przykład (Python / httpx)

```python
import httpx

with httpx.Client(base_url="http://localhost:8000") as client:
    r = client.post("/notes", json={"title": "Notatka", "content": "treść"})
    r.raise_for_status()
    print(r.json())
```

---

## 6. Schemat bazy danych

Tabela **`notes`**:

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | `VARCHAR` (PK) | UUID, generowany automatycznie |
| `title` | `VARCHAR` | domyślnie `""` |
| `content` | `VARCHAR` | domyślnie `""` |
| `created_at` | `TIMESTAMP` | niezmienne, ustawiane przy tworzeniu |
| `updated_at` | `TIMESTAMP` | aktualizowane przy każdej zmianie |
| `is_deleted` | `BOOLEAN` | miękkie usuwanie, domyślnie `false` |
| `user_id` | `VARCHAR` | domyślnie `"default_user"` |

Indeksy: `ix_notes_user_id` (`user_id`), `ix_notes_created_at` (`created_at`).

```sql
CREATE TABLE notes (
    id         VARCHAR PRIMARY KEY,
    title      VARCHAR NOT NULL DEFAULT '',
    content    VARCHAR NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    user_id    VARCHAR NOT NULL DEFAULT 'default_user'
);
CREATE INDEX ix_notes_user_id ON notes (user_id);
CREATE INDEX ix_notes_created_at ON notes (created_at);
```

> Tabela jest tworzona automatycznie przy starcie aplikacji (`Base.metadata.create_all`). Do produkcji rozważ migracje (Alembic).

---

## 7. Deployment

### Railway (backend + PWA + Postgres) — Terraform

Pełna konfiguracja w [`infra/terraform/`](infra/terraform).

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # uzupełnij token i repo
export RAILWAY_TOKEN="..."                      # albo wpisz w tfvars
terraform init
terraform plan
terraform apply
```

Tworzy: projekt Railway, usługę PostgreSQL (z wolumenem), backend (`backend/Dockerfile`), PWA (`pwa/Dockerfile`) oraz publiczne domeny. Outputy: `backend_url`, `pwa_url`, `database_url` (sensitive).

> Backend nasłuchuje na `$PORT` wstrzykiwanym przez Railway (lokalnie domyślnie 8000).

### Vercel (alternatywa dla PWA)

PWA to statyczny build Vite, więc można ją wdrożyć też na Vercel:

```bash
cd pwa
npx vercel --prod
# Ustaw zmienną środowiskową VITE_API_URL na URL backendu.
```

### Expo (mobile)

```bash
cd mobile
npx eas build --platform android   # lub ios
npx eas submit                     # publikacja do sklepu (wymaga konta EAS)
```

W produkcji ustaw `EXPO_PUBLIC_API_URL` na publiczny URL backendu (np. z Railway).

---

## 8. Testowanie

### Backend (pytest)

```bash
cd backend
pip install -r requirements.txt pytest-cov
pytest -v --cov=.        # testy używają SQLite (bez Postgresa)
```

Testy pokrywają wszystkie endpointy (CRUD, miękkie usuwanie, synchronizację).

### Test trybu offline (PWA)

1. Zbuduj i uruchom: `cd pwa && npm run build && npm run preview`
2. Otwórz w przeglądarce, w DevTools → **Network** → zaznacz **Offline**
3. Dodaj/edytuj notatki — zapiszą się w IndexedDB
4. Wyłącz tryb Offline — zmiany zostaną zsynchronizowane przez `/sync`

> Service Worker działa tylko w kontekście bezpiecznym (HTTPS lub `localhost`) — używaj `preview`, nie surowego `dev`.

### Test aparatu i lokalizacji (mobile)

- Aparat i lokalizacja działają na **fizycznym urządzeniu** (Expo Go), nie w przeglądarce/web.
- Pierwsze użycie poprosi o uprawnienia (kamera/lokalizacja/powiadomienia).
- W ekranie notatki użyj „📍 Tag location”, a w zakładce 📷 zrób zdjęcie i zapisz jako notatkę.

### Walidacja projektu mobile

```bash
cd mobile && npx expo-doctor      # 18 sprawdzeń konfiguracji
```

---

## 9. Troubleshooting

| Problem | Przyczyna / rozwiązanie |
|---|---|
| **Mobile pokazuje „offline”** | `localhost` na telefonie = sam telefon. Ustaw `EXPO_PUBLIC_API_URL` na **IP komputera w LAN** (np. `http://192.168.x.x:8000`) i zrestartuj `npx expo start -c`. |
| **Telefon nie łączy się z API** | Ten sam Wi-Fi co komputer + reguła firewalla na port 8000 (Windows): `New-NetFirewallRule -DisplayName "API 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow` |
| **Hermes: `private properties are not supported`** | Zła `babel.config.js` (np. `@babel/preset-env`). Powinno być tylko `presets: ['babel-preset-expo']`. Następnie `npx expo start -c`. |
| **`Cannot find module 'babel-preset-expo'`** | Dodaj jawnie do `devDependencies` w wersji zgodnej z SDK (np. `~54.0.11`) i `npm install`. |
| **npm `ERESOLVE`** | Niezgodne wersje Babela (np. `@babel/preset-env@8` wymaga `@babel/core@8`). Usuń zbędne paczki, `rm -rf node_modules package-lock.json && npm install`. |
| **Zmiana `.env` nie działa (mobile/PWA)** | Zmienne `EXPO_PUBLIC_*` / `VITE_*` są wstrzykiwane przy starcie buildu — zrestartuj serwer z czyszczeniem cache (`-c`). |
| **Health check zwraca 503** | Baza nieosiągalna — sprawdź `DATABASE_URL` i czy Postgres działa. |

---

## 10. Wytyczne dla kontrybutorów

1. **Branching** — pracuj na gałęziach `feat/...`, `fix/...`; nie commituj bezpośrednio na `main`.
2. **Commity** — zwięzłe, jednolinijkowe komunikaty w trybie rozkazującym (np. „Add sync endpoint”).
3. **Testy** — uruchom `pytest` (backend) i `npx expo-doctor` (mobile) przed PR; CI musi przejść na zielono.
4. **Styl** — backend: kod „samodokumentujący się”; web/mobile: spójny z istniejącymi komponentami.
5. **PR** — opisz zmianę, dołącz kroki weryfikacji; merge do `main` po review.
6. **Sekrety** — nigdy nie commituj `.env`, `terraform.tfvars` ani tokenów.

---

## Struktura repozytorium

```
simplenotes/
├── backend/            # FastAPI + PostgreSQL (main.py, testy, Dockerfile)
├── pwa/                # React + Vite PWA (Service Worker, IndexedDB)
├── mobile/             # Expo / React Native (zakładki, aparat, lokalizacja)
├── infra/terraform/    # IaC dla Railway
├── .github/workflows/  # CI/CD (GitHub Actions)
└── docker-compose.yml  # Postgres + backend lokalnie
```

### Więcej dokumentacji
- API (interaktywnie): `/docs` (Swagger) i `/redoc` po uruchomieniu backendu
- [FastAPI](https://fastapi.tiangolo.com/) · [Vite](https://vitejs.dev/) · [Expo](https://docs.expo.dev/) · [Railway](https://docs.railway.app/) · [Terraform Railway provider](https://registry.terraform.io/providers/terraform-community-providers/railway/latest/docs)
