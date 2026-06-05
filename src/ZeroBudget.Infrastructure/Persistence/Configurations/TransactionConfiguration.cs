using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.ValueObjects;
using ZeroBudget.Infrastructure.Persistence.Converters;

namespace ZeroBudget.Infrastructure.Persistence.Configurations;

public class TransactionConfiguration : IEntityTypeConfiguration<Transaction>
{
    public void Configure(EntityTypeBuilder<Transaction> builder)
    {
        builder.ToTable("Transactions");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.OwnerId)
            .IsRequired()
            .HasMaxLength(450);

        builder.Property(t => t.Amount)
            .HasPrecision(18, 4);

        // The transaction's own currency (may differ from the budget's base).
        builder.Property(t => t.Currency)
            .HasConversion(new CurrencyCodeConverter())
            .HasMaxLength(3)
            .IsRequired()
            .HasDefaultValue(CurrencyCode.Eur);

        // FX rate into the budget base currency; 6 dp is standard for rates.
        builder.Property(t => t.ExchangeRate)
            .HasPrecision(18, 6)
            .HasDefaultValue(1m);

        // BaseAmount is computed (Amount × ExchangeRate) and not persisted.
        builder.Ignore(t => t.BaseAmount);

        builder.Property(t => t.Payee)
            .HasMaxLength(200);

        builder.Property(t => t.Notes)
            .HasMaxLength(1000);

        builder.Property(t => t.BankReference)
            .HasMaxLength(140);

        builder.Property(t => t.Type)
            .HasConversion<int>();

        builder.HasIndex(t => t.OwnerId);

        // Speeds up the dedup lookup on re-import.
        builder.HasIndex(t => new { t.OwnerId, t.BankReference });
    }
}
