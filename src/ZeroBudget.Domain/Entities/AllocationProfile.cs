using ZeroBudget.Domain.Common;

namespace ZeroBudget.Domain.Entities;

/// <summary>
/// A named, ordered set of rules describing how the household's pooled net income is
/// routed each month (the spreadsheet's "Salary Split"). Shared costs are funded first,
/// then the surplus is split to each member's personal savings.
/// </summary>
public class AllocationProfile : BaseEntity
{
    public string OwnerId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// The account the allocated surplus is transferred out of when committing (e.g. the
    /// joint current account). A soft hint (no FK); required only to commit an allocation.
    /// </summary>
    public Guid? SourceAccountId { get; set; }

    public ICollection<AllocationRule> Rules { get; set; } = new List<AllocationRule>();
}
