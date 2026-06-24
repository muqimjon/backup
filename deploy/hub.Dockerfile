# ─────────────────────────────────────────────────────────────────────────────
# backuphub — control plane (Angular UI served by the .NET 10 API, one image).
# Build (from repo root):
#   docker build -f deploy/hub.Dockerfile -t muqimjon/backuphub .
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
COPY api/ ./
RUN dotnet restore BackupHub.slnx
COPY --from=web /web/dist/web/browser ./src/BackupHub.WebApi/wwwroot
RUN dotnet publish src/BackupHub.WebApi/BackupHub.WebApi.csproj -c Release -o /app

# Stage 3 — runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=api /app ./
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "BackupHub.WebApi.dll"]
