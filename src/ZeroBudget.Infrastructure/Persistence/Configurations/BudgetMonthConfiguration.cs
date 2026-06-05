using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ZeroBudget.Domain.Entities;

namespace ZeroBudget.Infrastructure.Persistence.Configurations;

public class BudgetMonthConfiguration : IEntityTypeConfiguration<BudgetMonth>
{
    public void Configure(EntityTypeBuilder<BudgetMonth> builder)
    {
        builder.ToTable("BudgetMonths");
        builder.HasKey(m => m.Id);

        builder.Property(m => m.OwnerId)
            .IsRequired()
            .HasMaxLength(450); // matches AspNetUsers.Id length

        builder.Property(m => m.TotalIncome)
            .HasPrecision(18, 4);

        // The computed Key / TotalPlanned / RemainingToBudget properties are
        // pure C# and must not be persisted.
        builder.Ignore(m => m.Key);
        builder.Ignore(m => m.TotalPlanned);
        builder.Ignore(m => m.RemainingToBudget);
        builder.Ignore(m => m.IsBalanced);

        // A user has exactly one budget per calendar month.
        builder.HasIndex(m => new { m.OwnerId, m.Year, m.Month }).IsUnique();

        builder.HasMany(m => m.Categories)
            .WithOne(c => c.BudgetMonth)
            .HasForeignKey(c => c.BudgetMonthId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
