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

        builder.Property(i => i.ManualActualAmount)
            .HasPrecision(18, 4);

        builder.Ignore(i => i.Remaining);

        // Transient presentation flag derived at read time, never persisted.
        builder.Ignore(i => i.IsActualTracked);

        builder.HasMany(i => i.Transactions)
            .WithOne(t => t.BudgetItem)
            .HasForeignKey(t => t.BudgetItemId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
