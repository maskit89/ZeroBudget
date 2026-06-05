using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
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

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    await ApplyMigrationsAsync(app);
}
else
{
    // Only force HTTPS outside Development so the Vite dev-server proxy (http) works.
    app.UseHttpsRedirection();
}

app.UseCors(SpaCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

// Applies any pending EF Core migrations on startup in Development so a fresh
// clone "just runs" against the configured SQL Server without a manual step.
static async Task ApplyMigrationsAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await db.Database.MigrateAsync();
}

// Exposed so the integration/unit test host can reference the entry point if needed.
public partial class Program { }
