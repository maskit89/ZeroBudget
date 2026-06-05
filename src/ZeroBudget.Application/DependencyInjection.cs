using System.Reflection;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using ZeroBudget.Application.Common.Behaviours;

namespace ZeroBudget.Application;

/// <summary>
/// Composition root for the Application layer. Registers MediatR handlers,
/// FluentValidation validators and the cross-cutting validation pipeline.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = Assembly.GetExecutingAssembly();

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(assembly);
            cfg.AddOpenBehavior(typeof(ValidationBehaviour<,>));
        });

        services.AddValidatorsFromAssembly(assembly);

        return services;
    }
}
