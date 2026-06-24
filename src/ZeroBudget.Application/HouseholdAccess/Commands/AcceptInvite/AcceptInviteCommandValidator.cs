using FluentValidation;

namespace ZeroBudget.Application.HouseholdAccess.Commands.AcceptInvite;

public class AcceptInviteCommandValidator : AbstractValidator<AcceptInviteCommand>
{
    public AcceptInviteCommandValidator()
    {
        RuleFor(x => x.Token).NotEmpty();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8);
        RuleFor(x => x.DisplayName).MaximumLength(120);
    }
}
