# Build stage - supports both repo-root context (Render default) and backend/HexaBill.Api context (render.yaml)
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# When context is repo root: use backend/HexaBill.Api/...; when context is backend/HexaBill.Api: use same path (only csproj exists)
COPY backend/HexaBill.Api/HexaBill.Api.csproj ./
RUN dotnet restore

COPY backend/HexaBill.Api/ ./
RUN dotnet publish -c Release -o /app/publish

# Run stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish ./

# PORT is set by Render at runtime; Program.cs reads it and binds to 0.0.0.0:PORT
EXPOSE 10000

ENTRYPOINT ["dotnet", "HexaBill.Api.dll"]
