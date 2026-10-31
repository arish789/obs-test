using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

var app = builder.Build();

app.UseCors();

var items = new List<Item>
{
    new Item(1, "Dotnet Item Alpha", "Enterprise core telemetry payload."),
    new Item(2, "Dotnet Item Beta", "Cloud microservice component."),
    new Item(3, "Dotnet Item Gamma", "Edge processor node.")
};

app.MapGet("/api/health", (ILogger<Program> logger) =>
{
    var isoTime = DateTime.UtcNow.ToString("o");
    logger.LogInformation("[HEALTH] Health check probe requested at: {Time}", isoTime);
    return Results.Ok(new { status = "ok", timestamp = isoTime, runtime = "dotnet" });
});

app.MapGet("/api/items", (ILogger<Program> logger) =>
{
    logger.LogInformation("[ITEMS] Fetching items list, total count: {Count}", items.Count);
    return Results.Ok(items);
});

app.MapGet("/api/items/{id:int}", (int id, ILogger<Program> logger) =>
{
    logger.LogInformation("[ITEM-DETAIL] Fetching item by ID: {Id}", id);
    var item = items.FirstOrDefault(i => i.Id == id);
    if (item is null)
    {
        logger.LogWarning("[ITEM-DETAIL] Item not found for ID: {Id}", id);
        return Results.NotFound(new { error = "Item not found" });
    }
    return Results.Ok(item);
});

app.MapGet("/api/error-test", (ILogger<Program> logger) =>
{
    logger.LogError("[TEST-ERROR] Simulated error logged for .NET observability testing");
    return Results.Problem("Simulated .NET test error", statusCode: 500);
});

var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
app.Run($"http://0.0.0.0:{port}");

public record Item(int Id, string Name, string Description);
