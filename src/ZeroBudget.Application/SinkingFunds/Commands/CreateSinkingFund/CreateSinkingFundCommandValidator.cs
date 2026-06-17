using FluentValidation;

namespace ZeroBudget.Application.SinkingFunds.Commands.CreateSinkingFund;

public class CreateSinkingFundCommandValidator : AbstractValidator<CreateSinkingFundCommand>
{
    // Mirrors the decimal(18,4) range used elsewhere (e.g. account opening balance).
    private const decimal MaxAmount = 99_999_999_999_999.9999m;

    public CreateSinkingFundCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("A fund needs a name.")
            .MaximumLength(120);

        RuleFor(x => x.Kind).IsInEnum();
        RuleFor(x => x.Accrual).IsInEnum();

        RuleFor(x => x.TargetAmount)
            .InclusiveBetween(0m, MaxAmount)
            .WithMessage("Target amount is out of range.");

        RuleFor(x => x.OpeningBalance)
            .InclusiveBetween(-MaxAmount, MaxAmount)
            .WithMessage("Opening balance is out of range.");

        // When both cover dates are given the window must be positive.
        RuleFor(x => x.CoverEnd)
            .GreaterThan(x => x.CoverStart!.Value)
            .When(x => x.CoverStart.HasValue && x.CoverEnd.HasValue)
            .WithMessage("Cover end must be after cover start.");
    }
}
