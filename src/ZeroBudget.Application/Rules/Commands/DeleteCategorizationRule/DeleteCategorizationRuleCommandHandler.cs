using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;

namespace ZeroBudget.Application.Rules.Commands.DeleteCategorizationRule;

public class DeleteCategorizationRuleCommandHandler : IRequestHandler<DeleteCategorizationRuleCommand>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public DeleteCategorizationRuleCommandHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task Handle(DeleteCategorizationRuleCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var rule = await _db.CategorizationRules
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

        if (rule is null)
        {
            throw new NotFoundException($"Categorization rule {request.Id} was not found.");
        }
        if (rule.OwnerId != userId)
        {
            throw new ForbiddenAccessException();
        }

        _db.CategorizationRules.Remove(rule);
        await _db.SaveChangesAsync(cancellationToken);
    }
}
