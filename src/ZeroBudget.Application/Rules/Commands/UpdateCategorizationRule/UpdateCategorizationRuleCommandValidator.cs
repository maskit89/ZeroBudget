using FluentValidation;

namespace ZeroBudget.Application.Rules.Commands.UpdateCategorizationRule;

public class UpdateCategorizationRuleCommandValidator : AbstractValidator<UpdateCategorizationRuleCommand>
{
    public UpdateCategorizationRuleCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty();

        RuleFor(x => x.CategoryName)
            .NotEmpty().WithMessage("A rule needs a category name.")
            .MaximumLength(120);

        RuleFor(x => x.ItemName)
            .NotEmpty().WithMessage("A rule needs a line name.")
            .MaximumLength(120);
    }
}
