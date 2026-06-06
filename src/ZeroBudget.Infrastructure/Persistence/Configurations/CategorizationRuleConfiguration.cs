using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ZeroBudget.Domain.Entities;

namespace ZeroBudget.Infrastructure.Persistence.Configurations;

public class CategorizationRuleConfiguration : IEntityTypeConfiguration<CategorizationRule>
{
    public void Configure(EntityTypeBuilder<CategorizationRule> builder)
    {
        builder.ToTable("CategorizationRules");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.OwnerId)
            .IsRequired()
            .HasMaxLength(450);

        builder.Property(r => r.PayeeKey)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(r => r.CategoryName)
            .IsRequired()
            .HasMaxLength(120);

        builder.Property(r => r.ItemName)
            .IsRequired()
            .HasMaxLength(120);

        // One rule per payee per user.
        builder.HasIndex(r => new { r.OwnerId, r.PayeeKey }).IsUnique();
    }
}
