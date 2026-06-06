using FluentAssertions;
using Xunit;
using ZeroBudget.Domain.Entities;

namespace ZeroBudget.Application.Tests.Transactions;

public class CategorizationRuleTests
{
    [Theory]
    [InlineData("REWE", "rewe")]
    [InlineData("  Landlord GmbH  ", "landlord gmbh")]
    [InlineData("ACME   Payroll", "acme payroll")] // collapses runs of whitespace
    [InlineData("London\tCab", "london cab")]
    public void NormalizeKey_TrimsLowercasesAndCollapsesWhitespace(string input, string expected)
    {
        CategorizationRule.NormalizeKey(input).Should().Be(expected);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void NormalizeKey_BlankInput_ReturnsEmpty(string? input)
    {
        CategorizationRule.NormalizeKey(input).Should().BeEmpty();
    }
}
