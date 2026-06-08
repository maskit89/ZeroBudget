using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Budgets.Dtos;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;
using ZeroBudget.Domain.ValueObjects;

namespace ZeroBudget.Application.Budgets.Commands.CreateBudgetMonth;

public class CreateBudgetMonthCommandHandler : IRequestHandler<CreateBudgetMonthCommand, BudgetMonthDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public CreateBudgetMonthCommandHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<BudgetMonthDto> Handle(CreateBudgetMonthCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var alreadyExists = await _db.BudgetMonths
            .AnyAsync(m => m.OwnerId == userId && m.Year == request.Year && m.Month == request.Month,
                cancellationToken);
        if (alreadyExists)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                [nameof(request.Month)] = new[] { $"A budget for {request.Year:D4}-{request.Month:D2} already exists." },
            });
        }

        // The most recent month strictly before the requested one — the copy source
        // and the currency to inherit.
        var previous = await _db.BudgetMonths
            .AsNoTracking()
            .Include(m => m.Categories)
                .ThenInclude(c => c.Items)
            .Where(m => m.OwnerId == userId
                        && (m.Year < request.Year || (m.Year == request.Year && m.Month < request.Month)))
            .OrderByDescending(m => m.Year)
                .ThenByDescending(m => m.Month)
            .FirstOrDefaultAsync(cancellationToken);

        var budget = new BudgetMonth
        {
            OwnerId = userId,
            Year = request.Year,
            Month = request.Month,
            BaseCurrency = previous?.BaseCurrency ?? CurrencyCode.Eur,
        };

        if (request.CopyFromPrevious && previous is not null)
        {
            // Copy the structure and planned amounts; actuals start fresh.
            budget.Categories = previous.Categories
                .OrderBy(c => c.DisplayOrder)
                .Select(c => new BudgetCategory
                {
                    Name = c.Name,
                    Kind = c.Kind,
                    DisplayOrder = c.DisplayOrder,
                    Items = c.Items
                        .OrderBy(i => i.DisplayOrder)
                        .Select(i => new BudgetItem
                        {
                            Name = i.Name,
                            PlannedAmount = i.PlannedAmount,
                            DisplayOrder = i.DisplayOrder,
                            ActualEntryMode = i.ActualEntryMode,
                            ManualActualAmount = 0m,
                            // Keep the fund's identity so its balance rolls over.
                            FundId = i.FundId,
                            // Bills recur, so the due day carries; paid resets (new month).
                            DueDay = i.DueDay,
                        })
                        .ToList(),
                })
                .ToList();
        }
        else
        {
            // A blank budget still keeps the Income group at the top.
            budget.Categories = new List<BudgetCategory>
            {
                new() { Name = "Income", Kind = CategoryKind.Income, DisplayOrder = 0 },
            };
        }

        _db.BudgetMonths.Add(budget);
        await _db.SaveChangesAsync(cancellationToken);

        var month = await _db.BudgetMonths
            .AsNoTracking()
            .Include(m => m.Categories)
                .ThenInclude(c => c.Items)
            .FirstAsync(m => m.Id == budget.Id, cancellationToken);

        await BudgetActuals.ApplyAsync(_db, userId, month, cancellationToken);

        return month.ToDto();
    }
}
