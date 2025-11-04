# Krok 1: Budowanie (używamy oficjalnego obrazu Mavena, który zawiera JDK 17)
# Ten obraz GWARANTUJE, że komenda 'mvn' istnieje.
FROM maven:3.8.5-openjdk-17 AS build
WORKDIR /app

# Kopiowanie i budowanie (bez zmian)
COPY pom.xml .
# Ta komenda teraz zadziała, bo 'mvn' jest w obrazie
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn package -DskipTests

# -------------------------------------------------------------------

# Krok 2: Uruchamianie (używamy lekkiego obrazu JRE Temurin)
# Ten obraz już wiemy, że działa i się pobiera.
FROM eclipse-temurin:17-jre
WORKDIR /app

# Ustaw domyślny port (bez zmian)
EXPOSE 8090

# Kopiowanie pliku .jar z kroku 1 (bez zmian)
COPY --from=build /app/target/*.jar app.jar

# Komenda uruchamiająca (bez zmian)
ENTRYPOINT ["java", "-jar", "app.jar"]

