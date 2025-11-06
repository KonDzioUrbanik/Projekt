# Krok 1: Budowanie (używamy Mavena z JDK 21)
# Zmieniamy 'openjdk-17' na obraz 'temurin-21', który jest stabilny
FROM maven:3-eclipse-temurin-21 AS build
WORKDIR /app

# Kopiowanie i budowanie (bez zmian)
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
# Ta komenda teraz zadziała, bo kompilator jest w wersji 21
RUN mvn package -DskipTests

# -------------------------------------------------------------------

# Krok 2: Uruchamianie (używamy JRE w wersji 21)
# Musimy też zaktualizować środowisko uruchomieniowe do JRE 21
FROM eclipse-temurin:21-jre
WORKDIR /app

# Ustaw domyślny port (bez zmian)
EXPOSE 8090

# Kopiowanie pliku .jar z kroku 1 (bez zmian)
COPY --from=build /app/target/*.jar app.jar


ENTRYPOINT ["java", "-jar", "app.jar"]

