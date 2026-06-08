using MediatR;
using ZeroBudget.Application.Budgets.Dtos;

namespace ZeroBudget.Application.Budgets.Commands.CreateBudgetMonth;

/// <summary>
/// Creates the user's budget for a month. When <paramref name="CopyFromPrevious"/>
/// is true and an earlier month exists, its groups and lines (and planned amounts)
/// are copied so the user doesn't start from scratch — actuals reset to zero.
/// Otherwise a blank budget with a single empty Income group is created.
/// Returns the new month.
/// </summary>
public record CreateBudgetMonthCommand(
    int Year,
    int Month,
    bool CopyFromPrevious = true) : IRequest<BudgetMonthDto>;
