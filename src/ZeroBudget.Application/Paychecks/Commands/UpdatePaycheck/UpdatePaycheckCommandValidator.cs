using FluentValidation;

namespace ZeroBudget.Application.Paychecks.Commands.UpdatePaycheck;

public class UpdatePaycheckCommandValidator : AbstractValidator<UpdatePaycheckCommand>
{
    public UpdatePaycheckCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("A paycheck needs a name.")
            .MaximumLength(120);

        RuleFor(x => x.PlannedAmount)
            .GreaterThan(0m).WithMessage("Enter a paycheck amount greater than zero.")
            .LessThanOrEqualTo(99_999_999_999_999.9999m);
    }
}
