using FluentValidation;

namespace ZeroBudget.Application.Paychecks.Commands.SetPaycheckAllocations;

public class SetPaycheckAllocationsCommandValidator : AbstractValidator<SetPaycheckAllocationsCommand>
{
    public SetPaycheckAllocationsCommandValidator()
    {
        RuleFor(x => x.PaycheckId)
            .NotEmpty();

        RuleFor(x => x.Allocations)
            .NotNull();

        RuleForEach(x => x.Allocations).ChildRules(a =>
        {
            a.RuleFor(x => x.BudgetItemId).NotEmpty();
            a.RuleFor(x => x.Amount)
                .GreaterThan(0m).WithMessage("Each allocation must be greater than zero.");
        });
    }
}
