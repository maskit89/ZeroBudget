using MediatR;
using ZeroBudget.Application.Accounts.Dtos;

namespace ZeroBudget.Application.Accounts.Queries.GetAccounts;

/// <summary>Lists the user's accounts with their derived current balances.</summary>
public record GetAccountsQuery : IRequest<IReadOnlyList<AccountDto>>;
