using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Paychecks.Dtos;

namespace ZeroBudget.Application.Paychecks.Commands.UpdatePaycheck;

public class UpdatePaycheckCommandHandler : IRequestHandler<UpdatePaycheckCommand, PaycheckDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public UpdatePaycheckCommandHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<PaycheckDto> Handle(UpdatePaycheckCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var paycheck = await _db.Paychecks
            .Include(p => p.Allocations)
                .ThenInclude(a => a.BudgetItem)
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        if (paycheck is null)
        {
            throw new NotFoundException($"Paycheck {request.Id} was not found.");
        }
        if (paycheck.OwnerId != userId)
        {
            throw new ForbiddenAccessException();
        }

        paycheck.Name = request.Name.Trim();
        paycheck.Date = request.Date;
        paycheck.PlannedAmount = request.PlannedAmount;

        await _db.SaveChangesAsync(cancellationToken);

        return paycheck.ToDto();
    }
}
