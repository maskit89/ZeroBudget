using MediatR;
using ZeroBudget.Application.Accounts.Dtos;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.Accounts.Commands.UpdateAccount;

/// <summary>
/// Edits an account's name, type and opening balance. Currency is immutable (changing
/// it would silently reinterpret the transaction history). Returns the updated account
/// with its recomputed current balance.
/// </summary>
public record UpdateAccountCommand(
    Guid Id,
    string Name,
    AccountType Type,
    decimal OpeningBalance) : IRequest<AccountDto>;
