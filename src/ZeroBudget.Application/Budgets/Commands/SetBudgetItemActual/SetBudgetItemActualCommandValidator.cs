using FluentValidation;

namespace ZeroBudget.Application.Budgets.Commands.SetBudgetItemActual;

public class SetBudgetItemActualCommandValidator : AbstractValidator<SetBudgetItemActualCommand>
{
    public SetBudgetItemActualCommandValidator()
    {
        RuleFor(x => x.BudgetItemId)
            .NotEmpty();

        RuleFor(x => x.ActualAmount)
            .GreaterThanOrEqualTo(0m)
            .WithMessage("Spent amount cannot be negative.")
            .LessThanOrEqualTo(99_999_999_999_999.9999m)
            .WithMessage("Spent amount exceeds the supported range.");
    }
}
