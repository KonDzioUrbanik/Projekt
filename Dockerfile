# Krok 1: Budowanie (używamy pełnego JDK Temurin)
FROM eclipse-temurin:17-jdk AS build
WORKDIR /app

# Kopiowanie i budowanie (bez zmian)
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn package -DskipTests

# -------------------------------------------------------------------

# Krok 2: Uruchamianie (używamy lekkiego JRE Temurin)
# To jest nowa, stabilna linia, która zastępuje "openjdk"
FROM eclipse-temurin:17-jre
WORKDIR /app

# Ustaw domyślny port (bez zmian)
EXPOSE 8090

# Kopiowanie pliku .jar z kroku 1 (bez zmian)
COPY --from=build /app/target/*.jar app.jar

# Komenda uruchamiająca (bez zmian)
ENTRYPOINT ["java", "-jar", "app.jar"]

