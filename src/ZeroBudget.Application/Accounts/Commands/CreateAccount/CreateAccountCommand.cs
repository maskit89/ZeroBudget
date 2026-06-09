using MediatR;
using ZeroBudget.Application.Accounts.Dtos;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.Accounts.Commands.CreateAccount;

/// <summary>Creates a new account for the user. Returns it (balance = opening balance).</summary>
public record CreateAccountCommand(
    string Name,
    AccountType Type,
    string Currency,
    decimal OpeningBalance) : IRequest<AccountDto>;
