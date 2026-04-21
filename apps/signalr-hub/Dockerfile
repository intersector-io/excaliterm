FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project file and restore
COPY TerminalProxy.Hub/TerminalProxy.Hub.csproj TerminalProxy.Hub/
RUN dotnet restore TerminalProxy.Hub/TerminalProxy.Hub.csproj

# Copy source and build
COPY TerminalProxy.Hub/ TerminalProxy.Hub/
RUN dotnet publish TerminalProxy.Hub/TerminalProxy.Hub.csproj -c Release -o /app/publish

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends wget \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000

ENTRYPOINT ["dotnet", "TerminalProxy.Hub.dll"]
