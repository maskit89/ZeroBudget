using MediatR;
using ZeroBudget.Application.Paychecks.Dtos;

namespace ZeroBudget.Application.Paychecks.Commands.UpdatePaycheck;

/// <summary>Edits a paycheck's name, date and planned amount. Returns it.</summary>
public record UpdatePaycheckCommand(
    Guid Id,
    string Name,
    DateOnly Date,
    decimal PlannedAmount) : IRequest<PaycheckDto>;
