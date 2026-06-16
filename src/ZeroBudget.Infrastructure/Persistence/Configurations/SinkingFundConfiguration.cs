using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Infrastructure.Persistence.Configurations;

public class SinkingFundConfiguration : IEntityTypeConfiguration<SinkingFund>
{
    public void Configure(EntityTypeBuilder<SinkingFund> builder)
    {
        builder.ToTable("SinkingFunds");
        builder.HasKey(f => f.Id);

        builder.Property(f => f.OwnerId)
            .IsRequired()
            .HasMaxLength(450);

        builder.Property(f => f.Name)
            .IsRequired()
            .HasMaxLength(120);

        // Stored as the enum's int value.
        builder.Property(f => f.Kind)
            .HasConversion<int>();

        builder.Property(f => f.Accrual)
            .HasConversion<int>()
            .HasDefaultValue(AccrualMethod.TargetByDate);

        // Financial precision: decimal(18,4) for all currency fields.
        builder.Property(f => f.TargetAmount)
            .HasPrecision(18, 4);

        builder.Property(f => f.OpeningBalance)
            .HasPrecision(18, 4);

        builder.HasIndex(f => f.OwnerId);
    }
}
