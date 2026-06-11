using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Paychecks.Dtos;
using ZeroBudget.Domain.Entities;

namespace ZeroBudget.Application.Paychecks.Commands.CreatePaycheck;

public class CreatePaycheckCommandHandler : IRequestHandler<CreatePaycheckCommand, PaycheckDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public CreatePaycheckCommandHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<PaycheckDto> Handle(CreatePaycheckCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var month = await _db.BudgetMonths
            .FirstOrDefaultAsync(m => m.Id == request.BudgetMonthId, cancellationToken);
        if (month is null)
        {
            throw new NotFoundException($"Budget month {request.BudgetMonthId} was not found.");
        }
        if (month.OwnerId != userId)
        {
            throw new ForbiddenAccessException();
        }

        var nextOrder = await _db.Paychecks
            .Where(p => p.BudgetMonthId == month.Id)
            .Select(p => (int?)p.DisplayOrder)
            .MaxAsync(cancellationToken) ?? -1;

        var paycheck = new Paycheck
        {
            OwnerId = userId,
            BudgetMonthId = month.Id,
            Name = request.Name.Trim(),
            Date = request.Date,
            PlannedAmount = request.PlannedAmount,
            DisplayOrder = nextOrder + 1,
        };

        _db.Paychecks.Add(paycheck);
        await _db.SaveChangesAsync(cancellationToken);

        return paycheck.ToDto();
    }
}
