# ZeroBudget 💶

A **Zero-Based Budgeting** (ZBB) web application for the European market. Every
Euro of income is given a job until **"Remaining to Budget" reaches €0.00**.

- **Backend:** ASP.NET Core Web API (clean architecture) + EF Core + SQL Server
- **Auth:** ASP.NET Core Identity issuing JWTs
- **Patterns:** CQRS via MediatR, FluentValidation pipeline
- **Frontend:** React + TypeScript (Vite) + TailwindCSS v4
- **Currency:** multi-currency — each budget has a `BaseCurrency` (default EUR);
  all amounts are `decimal(18,4)`; transactions carry their own currency + FX rate

> Targets **.NET 10** (the SDK installed on this machine). The original brief
> asked for .NET 8; only the `TargetFramework` string differs — the architecture,
> packages and code are identical.

---

## Solution layout

```
ZeroBudget/
├─ ZeroBudget.slnx
├─ src/
│  ├─ ZeroBudget.Domain          # Entities + pure ZBB calculation logic (no deps)
│  ├─ ZeroBudget.Application     # CQRS (MediatR), DTOs, abstractions, validation
│  ├─ ZeroBudget.Infrastructure  # EF Core DbContext, Identity, JWT, migrations
│  └─ ZeroBudget.Api             # Controllers, auth endpoints, DI, Swagger
├─ tests/
│  └─ ZeroBudget.Application.Tests  # xUnit: ZBB math + handler behaviour
└─ client/                       # Vite + React + TS + Tailwind dashboard
```

### Dependency rule (clean architecture)

```
Domain  ←  Application  ←  Infrastructure
                       ↖        ↑
                          Api (composition root)
```

`Domain` depends on nothing. `Application` depends only on `Domain` and defines
abstractions (`IApplicationDbContext`, `ICurrentUser`, `IJwtTokenGenerator`) that
`Infrastructure` / `Api` implement (Dependency Inversion).

---

## Core domain logic

The whole point of ZBB lives in `BudgetMonth` and is pure, testable C#:

```csharp
public decimal TotalPlanned       => Categories.Sum(c => c.TotalPlanned);
public decimal RemainingToBudget  => TotalIncome - TotalPlanned;
public bool    IsBalanced         => RemainingToBudget == 0m;
```

`RemainingToBudget` is computed server-side, shipped in the DTO, and returned again
on every edit so the banner updates dynamically.

---

## Multi-currency model

- A `BudgetMonth` has a **`BaseCurrency`** (`CurrencyCode` value object, ISO 4217,
  default `EUR`). Every planned/actual amount in the tree is in that currency, so
  totals stay summable and `RemainingToBudget` is unambiguous.
- A `Transaction` carries its **own `Currency` + `ExchangeRate`** (decimal(18,6))
  and exposes `BaseAmount = Amount × ExchangeRate` — the seam for converting
  foreign spending (e.g. GBP abroad) into the budget's base currency.
- `Money` (`decimal Amount` + `CurrencyCode`) is a value object that **forbids
  cross-currency arithmetic** — adding EUR to GBP throws rather than silently
  producing nonsense. Convert through an explicit rate first.
- The client formats every amount with the budget's currency symbol and never
  does money math in floating point (integer minor units at scale 4).

---

## Bank statement import (ISO 20022 / CAMT.053)

Upload a CAMT.053 XML statement and its entries become `Transaction`s.

- `POST /api/import/camt053` (multipart `file`, `[Authorize]`d) → import summary
  (`imported`, `skippedDuplicates`, `credits`, `debits`, `iban`).
- `Camt053StatementParser` (Infrastructure, behind the `IStatementParser`
  abstraction) reads `<Ntry>` elements **by local name**, so it handles every
  `camt.053.001.xx` namespace version. `CdtDbtInd` maps to income/expense, the
  entry keeps its own `Ccy`, and the payee comes from the creditor/debtor name.
- Re-importing is **idempotent**: entries are de-duplicated per user on their
  bank reference (`AcctSvcrRef`, falling back to `EndToEndId`).

---

## Running the backend

**Prerequisites:** .NET 10 SDK and SQL Server (LocalDB works out of the box on
Windows). The connection string is in `src/ZeroBudget.Api/appsettings.json`.

```bash
# from the repo root
dotnet build
dotnet run --project src/ZeroBudget.Api --launch-profile http
```

- API: <http://localhost:5029>
- Swagger UI (Development): <http://localhost:5029/swagger>
- In Development the API **creates the database and applies migrations on startup**.

### Database / migrations

```bash
dotnet ef migrations add <Name> \
  --project src/ZeroBudget.Infrastructure \
  --startup-project src/ZeroBudget.Api \
  --output-dir Persistence/Migrations

dotnet ef database update \
  --project src/ZeroBudget.Infrastructure \
  --startup-project src/ZeroBudget.Api
```

The initial migration `InitialCreate` creates the Identity tables plus
`BudgetMonths`, `BudgetCategories`, `BudgetItems`, `Transactions` — all currency
columns as `decimal(18,4)`, with a unique `(OwnerId, Year, Month)` index.

---

## Running the frontend

```bash
cd client
npm install
npm run dev      # http://localhost:5173
```

The Vite dev server proxies `/api` → `http://localhost:5029`, so run the API too.
Register a new account (you get a seeded starter budget), then drag a line's
planned amount until the banner turns green at €0.00.

---

## Tests

```bash
dotnet test                 # backend: xUnit (+ FluentAssertions, NSubstitute)
cd client && npm run test   # frontend: Vitest + React Testing Library
```

**Backend** (xUnit): `RemainingToBudgetTests` cover positive / zero / negative /
over-budget cases, **including zero income** and four-decimal precision;
`UpdateBudgetItemHandlerTests` prove the pool recomputes and that a user **cannot
mutate another user's** line; `Money`/`CurrencyCode` value-object tests; CAMT.053
parser and import-handler tests (idempotency, per-user scoping). NSubstitute is
used to isolate handlers from collaborators.

> FluentAssertions is pinned to **7.2.0** — the last Apache-2.0 release (8.x is
> commercially licensed).

**Frontend** (Vitest + RTL): `money`/`budgetModel` precision + selector tests, and
a `DashboardPage` test asserting **optimistic update + rollback** on a failed save.
Both suites run in CI on every push and PR.

---

## Security notes

- Every budgeting endpoint is `[Authorize]`d; handlers additionally scope all
  reads/writes to the caller's `OwnerId` (defence in depth — no IDOR).
- Login returns the **same message** for unknown email and wrong password (no
  account enumeration).
- The JWT signing key is **never committed**. `appsettings.json` carries no key,
  and the API **fails fast at startup** if `Jwt:Key` is missing or shorter than
  32 bytes (HS256 needs ≥ 256 bits). Supply it once via user-secrets (or the
  `Jwt__Key` environment variable in deployment):
```
dotnet user-secrets set "Jwt:Key" "<a long random secret, 32+ bytes>" --project src/ZeroBudget.Api
```
  Generate one quickly, e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`.
