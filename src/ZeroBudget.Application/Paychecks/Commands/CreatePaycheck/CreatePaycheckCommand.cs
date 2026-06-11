using MediatR;
using ZeroBudget.Application.Paychecks.Dtos;

namespace ZeroBudget.Application.Paychecks.Commands.CreatePaycheck;

/// <summary>Adds a paycheck to a budget month. Returns it (no allocations yet).</summary>
public record CreatePaycheckCommand(
    Guid BudgetMonthId,
    string Name,
    DateOnly Date,
    decimal PlannedAmount) : IRequest<PaycheckDto>;
