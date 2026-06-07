using FluentValidation;

namespace ZeroBudget.Application.Budgets.Commands.SetBudgetItemActualMode;

public class SetBudgetItemActualModeCommandValidator : AbstractValidator<SetBudgetItemActualModeCommand>
{
    public SetBudgetItemActualModeCommandValidator()
    {
        RuleFor(x => x.BudgetItemId)
            .NotEmpty();
    }
}
