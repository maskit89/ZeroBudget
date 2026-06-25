using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Household.Dtos;
using ZeroBudget.Domain.Entities;

namespace ZeroBudget.Application.Household.Commands.CreateHouseholdMember;

public class CreateHouseholdMemberCommandHandler
    : IRequestHandler<CreateHouseholdMemberCommand, HouseholdMemberDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public CreateHouseholdMemberCommandHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<HouseholdMemberDto> Handle(
        CreateHouseholdMemberCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.OwnerId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var nextOrder = await _db.HouseholdMembers
            .Where(m => m.OwnerId == userId)
            .Select(m => (int?)m.DisplayOrder)
            .MaxAsync(cancellationToken) ?? -1;

        var member = new HouseholdMember
        {
            OwnerId = userId,
            Name = request.Name.Trim(),
            NetMonthlyIncome = request.NetMonthlyIncome,
            PersonalSavingsAccountId = request.PersonalSavingsAccountId,
            DisplayOrder = nextOrder + 1,
        };

        _db.HouseholdMembers.Add(member);
        await _db.SaveChangesAsync(cancellationToken);

        var totalActiveNet = await _db.HouseholdMembers
            .Where(m => m.OwnerId == userId && !m.IsArchived)
            .SumAsync(m => m.NetMonthlyIncome, cancellationToken);

        return member.ToDto(totalActiveNet);
    }
}
