import com.android.build.api.artifact.SingleArtifact

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The app has no server and no network: it is the explorer's single-file page
// (dist/bip39-explorer.html, made by `npm run build:web` at the repository
// root) packaged as an asset and served to the web view from inside the APK.
//
//   -PbuildWeb=true          run `npm run build:web` first, rather than
//                            require a page someone built already
//   -PappVersionName=v…      the release's version (the release workflow
//   -PappVersionCode=N       passes both; N is the commit count)
val repoRoot = rootProject.projectDir.resolve("../..").canonicalFile
val webPage = repoRoot.resolve("dist/bip39-explorer.html")
val buildWeb = (findProperty("buildWeb") as String?) == "true"

android {
    namespace = "io.github.chinmay28.bip39explorer"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.github.chinmay28.bip39explorer"
        minSdk = 29
        targetSdk = 35
        // Stamped by the release workflow: the release's version as the name,
        // its commit count (which only grows) as the code.
        versionCode = (findProperty("appVersionCode") as String?)?.toInt() ?: 1
        versionName = (findProperty("appVersionName") as String?) ?: "dev"
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Signed with the release key when the build is handed one (the
            // release workflow decodes it from the ANDROID_KEYSTORE_* secrets),
            // so every release installs over the last. Without one, the debug
            // key: it sideloads, but it differs from machine to machine, so an
            // APK signed with it never installs over one built elsewhere.
            signingConfig = System.getenv("ANDROID_KEYSTORE")?.takeIf { it.isNotEmpty() }?.let { path ->
                signingConfigs.create("release") {
                    storeFile = file(path)
                    storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                    keyAlias = System.getenv("ANDROID_KEY_ALIAS")?.takeIf { it.isNotEmpty() } ?: "harbor"
                    keyPassword = System.getenv("ANDROID_KEY_PASSWORD")?.takeIf { it.isNotEmpty() }
                        ?: System.getenv("ANDROID_KEYSTORE_PASSWORD")
                }
            } ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    lint {
        disable += setOf(
            // allowBackup is off; there is nothing for fullBackupContent to say.
            "DataExtractionRules",
            // Versions move on purpose, together, not whenever lint notices.
            "GradleDependency",
        )
    }
}

/**
 * Copies the single-file page into the APK's assets as web/index.html, and
 * fails loudly when there is none: an APK without the page would install and
 * show nothing at all.
 */
abstract class BundleWebPage : DefaultTask() {
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val page: ConfigurableFileCollection

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun copy() {
        val source = page.singleFile
        if (!source.isFile) {
            throw GradleException(
                "no web page at $source — run `npm install && npm run build:web` at the " +
                    "repository root first, or pass -PbuildWeb=true",
            )
        }
        val html = source.readText()
        // The page must be whole: bundle-single.mjs inlines every script and
        // stylesheet, and anything still referenced would be a request the
        // app has no permission to make.
        if (Regex("""<(script|link)[^>]*\s(src|href)="(?!data:)""").containsMatchIn(html)) {
            throw GradleException("$source still references a file outside itself; rebuild it with npm run build:web")
        }
        val out = outputDir.get().asFile.resolve("web")
        out.deleteRecursively()
        out.mkdirs()
        source.copyTo(out.resolve("index.html"), overwrite = true)
    }
}

val npmBuildWeb = tasks.register<Exec>("npmBuildWeb") {
    description = "Builds the web client and its single-file page (npm run build:web)"
    workingDir = repoRoot
    commandLine("npm", "run", "build:web")
}

val bundleWebPage = tasks.register<BundleWebPage>("bundleWebPage") {
    description = "Packages dist/bip39-explorer.html as the app's page"
    page.from(webPage)
    outputDir.set(layout.buildDirectory.dir("generated/webPage"))
    if (buildWeb) dependsOn(npmBuildWeb)
}

/**
 * The app makes no network requests, and the strongest way to say so is that
 * it cannot: without the INTERNET permission Android gives it no sockets at
 * all. This reads the merged manifest — the app's own plus every library's —
 * and fails the build if any permission is requested beyond the one AndroidX
 * declares for its own broadcast receivers.
 */
abstract class CheckPermissions : DefaultTask() {
    @get:InputFile
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val manifest: RegularFileProperty

    @get:Input
    abstract val applicationId: Property<String>

    @TaskAction
    fun check() {
        val xml = manifest.get().asFile.readText()
        val requested = Regex("""<uses-permission(?:-sdk-23)?\b[^>]*android:name="([^"]+)"""")
            .findAll(xml).map { it.groupValues[1] }.toSet()
        val allowed = setOf("${applicationId.get()}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION")
        val extra = requested - allowed
        if (extra.isNotEmpty()) {
            throw GradleException(
                "the merged manifest asks for ${extra.sorted()} — BIP-39 Explorer must hold no " +
                    "network (or any other) permission. See apps/android/README.md.",
            )
        }
    }
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(bundleWebPage, BundleWebPage::outputDir)

        val name = variant.name.replaceFirstChar { it.uppercase() }
        val check = tasks.register<CheckPermissions>("check${name}Permissions") {
            description = "Fails if the merged $name manifest requests any permission"
            manifest.set(variant.artifacts.get(SingleArtifact.MERGED_MANIFEST))
            applicationId.set(variant.applicationId)
        }
        tasks.matching { it.name == "assemble$name" || it.name == "lint$name" || it.name == "check" }
            .configureEach { dependsOn(check) }
    }
}

dependencies {
    implementation(project(":core"))
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("com.google.android.material:material:1.12.0")
}
