using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using ZeroBudget.Api.Features;
using ZeroBudget.Api.Middleware;
using ZeroBudget.Api.Services;
using ZeroBudget.Application;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Infrastructure;
using ZeroBudget.Infrastructure.Identity;
using ZeroBudget.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

const string SpaCorsPolicy = "SpaCors";

// --- Layer composition ------------------------------------------------------
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// HTTP-context-backed implementation of the Application's ICurrentUser.
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();

builder.Services.AddControllers();
builder.Services.AddAuthorization();

// Liveness probe (no DB dependency) consumed by the deploy pipeline's smoke test.
builder.Services.AddHealthChecks();

// Feature toggles for the beyond-EveryDollar features (all default ON).
builder.Services.Configure<FeatureFlags>(builder.Configuration.GetSection(FeatureFlags.SectionName));

// CORS for the Vite dev server (configurable via Cors:AllowedOrigins).
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:5173" };
builder.Services.AddCors(options =>
    options.AddPolicy(SpaCorsPolicy, policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()));

// --- Swagger with JWT bearer support ----------------------------------------
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "ZeroBudget API", Version = "v1" });

    var scheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the JWT returned by /api/auth/login (no 'Bearer ' prefix needed).",
        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
    };
    options.AddSecurityDefinition("Bearer", scheme);
    options.AddSecurityRequirement(new OpenApiSecurityRequirement { [scheme] = Array.Empty<string>() });
});

var app = builder.Build();

// --- HTTP pipeline ----------------------------------------------------------
app.UseMiddleware<ExceptionHandlingMiddleware>();

// Apply any pending EF Core migrations on startup so the configured SQL Server
// schema is always current — in Development against LocalDB, and in Production
// against the SQL Server service on the VPS right after a deploy. Migrations are
// additive and idempotent: they never drop existing data.
await ApplyMigrationsAsync(app);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// NOTE: in Production, HTTPS is terminated at the IIS reverse proxy and the API is
// reached over plain HTTP on localhost. Forcing an HTTPS redirect here would break
// those proxied /api calls, so edge HTTPS (and the http->https redirect) is left to
// IIS. In Development the Vite proxy likewise talks to the API over http.

app.UseCors(SpaCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Liveness endpoint: returns 200 once the app is up. The deploy script polls
// http://localhost:5000/health to verify a new build before completing.
app.MapHealthChecks("/health");

app.Run();

// Applies any pending EF Core migrations on startup. Retries briefly so the API
// doesn't fail to boot while the SQL Server service is still coming up (e.g. right
// after a VPS reboot). Migrations are additive and never drop existing data.
static async Task ApplyMigrationsAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    const int maxAttempts = 10;
    for (var attempt = 1; attempt <= maxAttempts; attempt++)
    {
        try
        {
            await db.Database.MigrateAsync();
            logger.LogInformation("Database migrations applied (attempt {Attempt}).", attempt);
            return;
        }
        catch (Exception ex) when (attempt < maxAttempts)
        {
            logger.LogWarning(ex,
                "Migration attempt {Attempt}/{Max} failed; SQL Server may still be starting. Retrying in 3s...",
                attempt, maxAttempts);
            await Task.Delay(TimeSpan.FromSeconds(3));
        }
    }
}

// Exposed so the integration/unit test host can reference the entry point if needed.
public partial class Program { }
