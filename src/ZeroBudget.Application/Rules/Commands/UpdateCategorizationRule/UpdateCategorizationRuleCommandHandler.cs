using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Rules.Dtos;

namespace ZeroBudget.Application.Rules.Commands.UpdateCategorizationRule;

public class UpdateCategorizationRuleCommandHandler
    : IRequestHandler<UpdateCategorizationRuleCommand, CategorizationRuleDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public UpdateCategorizationRuleCommandHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<CategorizationRuleDto> Handle(
        UpdateCategorizationRuleCommand request, CancellationToken cancellationToken)
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

        rule.CategoryName = request.CategoryName.Trim();
        rule.ItemName = request.ItemName.Trim();

        await _db.SaveChangesAsync(cancellationToken);

        return rule.ToDto();
    }
}
