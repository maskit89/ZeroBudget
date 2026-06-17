using MediatR;
using ZeroBudget.Application.Household.Dtos;

namespace ZeroBudget.Application.Household.Commands.CreateHouseholdMember;

/// <summary>Adds a person to the household. Returns the new member.</summary>
public record CreateHouseholdMemberCommand(
    string Name,
    decimal NetMonthlyIncome,
    Guid? PersonalSavingsAccountId) : IRequest<HouseholdMemberDto>;
