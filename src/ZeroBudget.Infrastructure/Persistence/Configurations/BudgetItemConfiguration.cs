using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ZeroBudget.Domain.Entities;

namespace ZeroBudget.Infrastructure.Persistence.Configurations;

public class BudgetItemConfiguration : IEntityTypeConfiguration<BudgetItem>
{
    public void Configure(EntityTypeBuilder<BudgetItem> builder)
    {
        builder.ToTable("BudgetItems");
        builder.HasKey(i => i.Id);

        builder.Property(i => i.Name)
            .IsRequired()
            .HasMaxLength(120);

        // Financial precision: decimal(18,4) for all currency fields.
        builder.Property(i => i.PlannedAmount)
            .HasPrecision(18, 4);

        builder.Property(i => i.ActualAmount)
            .HasPrecision(18, 4);

        builder.Ignore(i => i.Remaining);

        // Transient presentation value derived at read time, never persisted.
        builder.Ignore(i => i.FundAvailable);

        // IsBill is derived from DueDay; the columns themselves map by convention.
        builder.Ignore(i => i.IsBill);

        // Stable id linking a sinking fund's monthly instances; indexed for the
        // cross-month balance roll-up. Null for ordinary income/expense lines.
        builder.HasIndex(i => i.FundId);

        // A fund line's FundId is the id of its SinkingFund (shared across the fund's
        // monthly instances). Deleting a fund detaches its lines — they become ordinary
        // lines rather than deleting budget history — mirroring Transaction -> BudgetItem.
        // No navigation property: keeps BudgetItem unaware of the fund definition.
        builder.HasOne<SinkingFund>()
            .WithMany()
            .HasForeignKey(i => i.FundId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(i => i.Transactions)
            .WithOne(t => t.BudgetItem)
            .HasForeignKey(t => t.BudgetItemId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
