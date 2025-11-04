# Krok 1: Użyj obrazu z Javą i Mavenem do ZBUDOWANIA aplikacji
FROM maven:3.8.5-openjdk-17 AS build
WORKDIR /app

# Skopiuj pliki Mavena i pobierz zależności (optymalizacja cache)
COPY pom.xml .
RUN mvn dependency:go-offline

# Skopiuj resztę kodu źródłowego i zbuduj aplikację
COPY src ./src
RUN mvn package -DskipTests

# -------------------------------------------------------------------

# Krok 2: Użyj lekkiego obrazu Javy do URUCHOMIENIA aplikacji
# Używamy bardziej stabilnego i konkretnego tagu obrazu
FROM openjdk:17-jdk-slim-bullseye
WORKDIR /app

# Ustaw domyślny port, który będzie widoczny
EXPOSE 8090

# Skopiuj zbudowany plik .jar z kroku "build"
COPY --from=build /app/target/*.jar app.jar

# Komenda uruchamiająca Twoją aplikację Spring Boot
ENTRYPOINT ["java", "-jar", "app.jar"]

