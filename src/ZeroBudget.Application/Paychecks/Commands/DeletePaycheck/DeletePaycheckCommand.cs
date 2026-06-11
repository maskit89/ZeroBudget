using MediatR;

namespace ZeroBudget.Application.Paychecks.Commands.DeletePaycheck;

/// <summary>Deletes a paycheck and its allocations.</summary>
public record DeletePaycheckCommand(Guid Id) : IRequest;
