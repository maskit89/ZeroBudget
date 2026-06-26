using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ZeroBudget.Infrastructure.Identity;

namespace ZeroBudget.Infrastructure.Persistence.Configurations;

/// <summary>
/// Column shapes for the profile + display-preference fields added to the Identity user.
/// The currency/format columns are non-null with a default so existing logins (created
/// before these columns existed) backfill to the application defaults on migration.
/// </summary>
public class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.Property(u => u.FirstName).HasMaxLength(128);
        builder.Property(u => u.LastName).HasMaxLength(128);

        builder.Property(u => u.PreferredCurrency)
            .IsRequired()
            .HasMaxLength(3)
            .HasDefaultValue(UserPreferences.DefaultCurrency);

        builder.Property(u => u.NumberFormat)
            .IsRequired()
            .HasMaxLength(32)
            .HasDefaultValue(UserPreferences.DefaultNumberFormat);
    }
}
