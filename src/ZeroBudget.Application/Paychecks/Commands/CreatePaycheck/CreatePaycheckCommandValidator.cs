using FluentValidation;

namespace ZeroBudget.Application.Paychecks.Commands.CreatePaycheck;

public class CreatePaycheckCommandValidator : AbstractValidator<CreatePaycheckCommand>
{
    public CreatePaycheckCommandValidator()
    {
        RuleFor(x => x.BudgetMonthId)
            .NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("A paycheck needs a name.")
            .MaximumLength(120);

        RuleFor(x => x.PlannedAmount)
            .GreaterThan(0m).WithMessage("Enter a paycheck amount greater than zero.")
            .LessThanOrEqualTo(99_999_999_999_999.9999m);
    }
}
