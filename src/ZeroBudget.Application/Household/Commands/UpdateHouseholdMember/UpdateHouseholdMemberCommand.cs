using MediatR;
using ZeroBudget.Application.Household.Dtos;

namespace ZeroBudget.Application.Household.Commands.UpdateHouseholdMember;

/// <summary>Edits a household member. Returns the updated member.</summary>
public record UpdateHouseholdMemberCommand(
    Guid Id,
    string Name,
    decimal NetMonthlyIncome,
    Guid? PersonalSavingsAccountId) : IRequest<HouseholdMemberDto>;
