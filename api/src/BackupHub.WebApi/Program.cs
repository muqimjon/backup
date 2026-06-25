using System.Text;
using BackupHub.Application;
using BackupHub.Application.Abstractions;
using BackupHub.Infrastructure;
using BackupHub.Infrastructure.Persistence;
using BackupHub.WebApi.Common;
using BackupHub.WebApi.Hubs;
using BackupHub.WebApi.Metrics;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Prometheus;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

const string DevCors = "dev";

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddSignalR();
builder.Services.AddSingleton<IMetricsRecorder, PrometheusMetricsRecorder>();
builder.Services.AddScoped<IRunNotifier, SignalRRunNotifier>();
builder.Services.AddCors(options => options.AddPolicy(DevCors, policy =>
    policy.WithOrigins("http://localhost:4200").AllowAnyHeader().AllowAnyMethod()));

var jwt = builder.Configuration.GetSection("Jwt");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt["Issuer"],
            ValidateAudience = true,
            ValidAudience = jwt["Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!)),
            ValidateLifetime = true,
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

app.UseMiddleware<ExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
    app.UseCors(DevCors);
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseHttpMetrics();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapMetrics();
app.MapHub<RunsHub>("/hubs/runs");
app.MapFallbackToFile("index.html");

await DbInitializer.InitializeAsync(app.Services);

app.Run();
