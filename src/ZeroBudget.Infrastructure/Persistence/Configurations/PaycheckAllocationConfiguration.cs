using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ZeroBudget.Domain.Entities;

namespace ZeroBudget.Infrastructure.Persistence.Configurations;

public class PaycheckAllocationConfiguration : IEntityTypeConfiguration<PaycheckAllocation>
{
    public void Configure(EntityTypeBuilder<PaycheckAllocation> builder)
    {
        builder.ToTable("PaycheckAllocations");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Amount)
            .HasPrecision(18, 4);

        // Deleting the parent paycheck removes its allocations.
        builder.HasOne(a => a.Paycheck)
            .WithMany(p => p.Allocations)
            .HasForeignKey(a => a.PaycheckId)
            .OnDelete(DeleteBehavior.Cascade);

        // Reference to the funded line. NoAction (not SetNull) because the allocation
        // is already reachable from BudgetMonth via the Paycheck cascade — a second
        // delete path through BudgetItem would be a multiple-cascade-path error on SQL
        // Server. Line deletion instead removes its allocations explicitly in
        // DeleteBudgetItemCommandHandler.
        builder.HasOne(a => a.BudgetItem)
            .WithMany()
            .HasForeignKey(a => a.BudgetItemId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(a => a.PaycheckId);
        builder.HasIndex(a => a.BudgetItemId);
    }
}
