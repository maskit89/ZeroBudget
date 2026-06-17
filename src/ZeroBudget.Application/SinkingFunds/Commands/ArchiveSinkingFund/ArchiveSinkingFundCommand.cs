using MediatR;
using ZeroBudget.Application.SinkingFunds.Dtos;

namespace ZeroBudget.Application.SinkingFunds.Commands.ArchiveSinkingFund;

/// <summary>
/// Archives (or restores) a sinking fund. Archiving is soft — the fund and its history
/// are kept so past months still reconcile; it is just hidden from the active list and
/// from month-contribution seeding. Returns the updated fund.
/// </summary>
public record ArchiveSinkingFundCommand(Guid Id, bool Archived = true) : IRequest<SinkingFundDto>;
