using MediatR;
using ZeroBudget.Application.Allocation.Dtos;

namespace ZeroBudget.Application.Allocation.Queries.GetAllocationProfile;

/// <summary>Returns the household's allocation profile (the first one), or null if none is set up yet.</summary>
public record GetAllocationProfileQuery : IRequest<AllocationProfileDto?>;
