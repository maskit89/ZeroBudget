using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ZeroBudget.Domain.Entities;

namespace ZeroBudget.Infrastructure.Persistence.Configurations;

public class PaycheckConfiguration : IEntityTypeConfiguration<Paycheck>
{
    public void Configure(EntityTypeBuilder<Paycheck> builder)
    {
        builder.ToTable("Paychecks");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.OwnerId)
            .IsRequired()
            .HasMaxLength(450);

        builder.Property(p => p.Name)
            .IsRequired()
            .HasMaxLength(120);

        builder.Property(p => p.PlannedAmount)
            .HasPrecision(18, 4);

        // Derived from the allocations; never persisted.
        builder.Ignore(p => p.AllocatedAmount);
        builder.Ignore(p => p.Remaining);

        builder.HasIndex(p => p.OwnerId);
        builder.HasIndex(p => p.BudgetMonthId);

        // Deleting a month removes its paychecks (and, via the next config, their allocations).
        builder.HasOne(p => p.BudgetMonth)
            .WithMany()
            .HasForeignKey(p => p.BudgetMonthId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
