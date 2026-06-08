using FluentValidation;

namespace ZeroBudget.Application.Budgets.Commands.ReorderBudgetCategories;

public class ReorderBudgetCategoriesCommandValidator : AbstractValidator<ReorderBudgetCategoriesCommand>
{
    public ReorderBudgetCategoriesCommandValidator()
    {
        RuleFor(x => x.BudgetMonthId)
            .NotEmpty();

        RuleFor(x => x.OrderedCategoryIds)
            .NotEmpty().WithMessage("Provide the category order.");
    }
}
