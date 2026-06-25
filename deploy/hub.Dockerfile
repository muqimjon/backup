# ─────────────────────────────────────────────────────────────────────────────
# backuphub — control plane (Angular UI served by the .NET 10 API, one image).
# Build (from repo root):
#   docker build -f deploy/hub.Dockerfile -t muqimjon/zaxira-hub .
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1 — build the Angular SPA
FROM node:24-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2 — build & publish the .NET API (with the SPA embedded as wwwroot)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
# Restore using only the project files first — this layer stays cached across
# source-only changes, so rebuilds skip the slow package restore.
COPY api/BackupHub.slnx ./
COPY api/src/BackupHub.Domain/BackupHub.Domain.csproj ./src/BackupHub.Domain/
COPY api/src/BackupHub.Application/BackupHub.Application.csproj ./src/BackupHub.Application/
COPY api/src/BackupHub.Infrastructure/BackupHub.Infrastructure.csproj ./src/BackupHub.Infrastructure/
COPY api/src/BackupHub.WebApi/BackupHub.WebApi.csproj ./src/BackupHub.WebApi/
RUN dotnet restore BackupHub.slnx
COPY api/ ./
COPY --from=web /web/dist/web/browser ./src/BackupHub.WebApi/wwwroot
RUN dotnet publish src/BackupHub.WebApi/BackupHub.WebApi.csproj -c Release -o /app --no-restore

# Stage 3 — runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=api /app ./
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "BackupHub.WebApi.dll"]
