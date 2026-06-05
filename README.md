# ZeroBudget 💶

A **Zero-Based Budgeting** (ZBB) web application for the European market. Every
Euro of income is given a job until **"Remaining to Budget" reaches €0.00**.

- **Backend:** ASP.NET Core Web API (clean architecture) + EF Core + SQL Server
- **Auth:** ASP.NET Core Identity issuing JWTs
- **Patterns:** CQRS via MediatR, FluentValidation pipeline
- **Frontend:** React + TypeScript (Vite) + TailwindCSS v4
- **Currency:** Euro, stored as `decimal(18,4)` for financial precision

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
dotnet test
```

`RemainingToBudgetTests` validate the calculation across positive / zero / negative
/ over-budget cases, **including zero income** and four-decimal precision.
`UpdateBudgetItemHandlerTests` prove the pool recomputes after an edit and that a
user **cannot mutate another user's** budget line.

---

## Security notes

- Every budgeting endpoint is `[Authorize]`d; handlers additionally scope all
  reads/writes to the caller's `OwnerId` (defence in depth — no IDOR).
- Login returns the **same message** for unknown email and wrong password (no
  account enumeration).
- The JWT signing key in `appsettings.json` is a **development placeholder**. For
  any real deployment, supply `Jwt:Key` via user-secrets / environment variables
  and use a key of at least 32 bytes.
```
dotnet user-secrets set "Jwt:Key" "<a long random secret>" --project src/ZeroBudget.Api
```
