FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project file and restore
COPY Excaliterm.Hub/Excaliterm.Hub.csproj Excaliterm.Hub/
RUN dotnet restore Excaliterm.Hub/Excaliterm.Hub.csproj

# Copy source and build
COPY Excaliterm.Hub/ Excaliterm.Hub/
RUN dotnet publish Excaliterm.Hub/Excaliterm.Hub.csproj -c Release -o /app/publish

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends wget \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000

ENTRYPOINT ["dotnet", "Excaliterm.Hub.dll"]
