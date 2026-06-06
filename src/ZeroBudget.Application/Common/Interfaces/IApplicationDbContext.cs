using Microsoft.EntityFrameworkCore;
using ZeroBudget.Domain.Entities;

namespace ZeroBudget.Application.Common.Interfaces;

/// <summary>
/// Abstraction over the persistence store, exposed to the Application layer so
/// handlers never depend on the concrete EF Core / SQL Server implementation
/// that lives in Infrastructure.
/// </summary>
public interface IApplicationDbContext
{
    DbSet<BudgetMonth> BudgetMonths { get; }
    DbSet<BudgetCategory> BudgetCategories { get; }
    DbSet<BudgetItem> BudgetItems { get; }
    DbSet<Transaction> Transactions { get; }
    DbSet<CategorizationRule> CategorizationRules { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
