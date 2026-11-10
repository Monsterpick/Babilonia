plugins {
    java
    id("xyz.jpenilla.run-paper") version "3.0.2"
}

group = "dev.livearena"
version = "1.0.0"

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
}

val paperVersion: String = providers.gradleProperty("paperVersion").get()

dependencies {
    compileOnly("io.papermc.paper:paper-api:$paperVersion")
}

java {
    // Paper 26.1.x requiere Java 25.
    toolchain.languageVersion.set(JavaLanguageVersion.of(25))
}

tasks {
    compileJava {
        options.encoding = "UTF-8"
        options.release.set(25)
        options.compilerArgs.add("-Xlint:deprecation")
    }
    processResources {
        val props = mapOf("version" to project.version)
        inputs.properties(props)
        filesMatching("paper-plugin.yml") { expand(props) }
    }
    jar {
        archiveFileName.set("BaseDefense.jar")
    }
    // ./gradlew runServer → servidor Paper 26.1.2 de prueba en run/ con el plugin cargado.
    runServer {
        minecraftVersion("26.1.2")
        jvmArgs("-Xmx3G", "-Dcom.mojang.eula.agree=true")
    }
}
