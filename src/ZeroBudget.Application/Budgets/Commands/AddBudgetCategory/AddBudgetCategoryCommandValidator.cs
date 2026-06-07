using FluentValidation;

namespace ZeroBudget.Application.Budgets.Commands.AddBudgetCategory;

public class AddBudgetCategoryCommandValidator : AbstractValidator<AddBudgetCategoryCommand>
{
    public AddBudgetCategoryCommandValidator()
    {
        RuleFor(x => x.BudgetMonthId)
            .NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("A category group needs a name.")
            .MaximumLength(120);
    }
}
