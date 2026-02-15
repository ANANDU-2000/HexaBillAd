# Build stage - works when Docker context is repo root (Render: rootDir empty, dockerContext ".")
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY HexaBill.Api.csproj ./
RUN dotnet restore

COPY . ./
RUN dotnet publish -c Release -o /app/publish

# Run stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish ./

# PORT is set by Render at runtime; Program.cs reads it and binds to 0.0.0.0:PORT
EXPOSE 10000

ENTRYPOINT ["dotnet", "HexaBill.Api.dll"]
