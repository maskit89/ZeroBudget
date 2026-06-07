using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Budgets.Dtos;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.Budgets.Commands.AddBudgetCategory;

public class AddBudgetCategoryCommandHandler : IRequestHandler<AddBudgetCategoryCommand, BudgetMonthDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public AddBudgetCategoryCommandHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<BudgetMonthDto> Handle(AddBudgetCategoryCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var month = await _db.BudgetMonths
            .Include(m => m.Categories)
            .FirstOrDefaultAsync(m => m.Id == request.BudgetMonthId, cancellationToken);

        if (month is null)
        {
            throw new NotFoundException($"Budget month {request.BudgetMonthId} was not found.");
        }

        // Ownership re-check (defence in depth — never trust the id alone).
        if (month.OwnerId != userId)
        {
            throw new ForbiddenAccessException();
        }

        // New groups are expenses and append after the existing expense groups.
        var expenseOrders = month.Categories
            .Where(c => c.Kind == CategoryKind.Expense)
            .Select(c => c.DisplayOrder)
            .ToList();
        var nextOrder = expenseOrders.Count == 0 ? 0 : expenseOrders.Max() + 1;

        _db.BudgetCategories.Add(new BudgetCategory
        {
            BudgetMonthId = month.Id,
            Name = request.Name.Trim(),
            Kind = CategoryKind.Expense,
            DisplayOrder = nextOrder,
        });

        await _db.SaveChangesAsync(cancellationToken);

        var reloaded = await _db.BudgetMonths
            .AsNoTracking()
            .Include(m => m.Categories)
                .ThenInclude(c => c.Items)
            .FirstAsync(m => m.Id == month.Id, cancellationToken);

        await BudgetActuals.ApplyAsync(_db, userId, reloaded, cancellationToken);

        return reloaded.ToDto();
    }
}
