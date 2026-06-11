using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;

namespace ZeroBudget.Application.Paychecks.Commands.DeletePaycheck;

public class DeletePaycheckCommandHandler : IRequestHandler<DeletePaycheckCommand>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public DeletePaycheckCommandHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task Handle(DeletePaycheckCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var paycheck = await _db.Paychecks
            .Include(p => p.Allocations)
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        if (paycheck is null)
        {
            throw new NotFoundException($"Paycheck {request.Id} was not found.");
        }
        if (paycheck.OwnerId != userId)
        {
            throw new ForbiddenAccessException();
        }

        // Remove the allocations explicitly (their BudgetItem FK is NoAction), then the paycheck.
        if (paycheck.Allocations.Count > 0)
        {
            _db.PaycheckAllocations.RemoveRange(paycheck.Allocations);
        }
        _db.Paychecks.Remove(paycheck);
        await _db.SaveChangesAsync(cancellationToken);
    }
}
