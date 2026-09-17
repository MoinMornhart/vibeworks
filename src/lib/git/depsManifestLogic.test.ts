import { describe, expect, it } from "vitest";
import {
  findManifests,
  goProxyPath,
  mergeDeps,
  packageUrl,
  parseCargo,
  parseComposer,
  parseGoMod,
  parseGradle,
  parseManifestFile,
  parsePom,
  parsePyproject,
  parseRequirements,
  parseVersionCatalog,
} from "./depsManifestLogic";

describe("Manifeste finden (#105)", () => {
  it("flach zuerst, ohne node_modules und zu tiefe Pfade", () => {
    const files = [
      "apps/web/package.json",
      "package.json",
      "node_modules/x/package.json",
      "a/b/c/d/package.json",
      "backend/requirements-dev.txt",
      "go.mod",
      "README.md",
      "android/app/build.gradle.kts",
      "gradle/libs.versions.toml",
    ];
    expect(findManifests(files)).toEqual([
      { path: "go.mod", ecosystem: "Go" },
      { path: "package.json", ecosystem: "npm" },
      { path: "backend/requirements-dev.txt", ecosystem: "PyPI" },
      { path: "gradle/libs.versions.toml", ecosystem: "Maven" },
      { path: "android/app/build.gradle.kts", ecosystem: "Maven" },
      { path: "apps/web/package.json", ecosystem: "npm" },
    ]);
  });
});

describe("Python", () => {
  it("requirements.txt", () => {
    const text = "# Kommentar\nDjango==4.2.1\nrequests[socks]>=2.31 ; python_version > '3.8'\n-r base.txt\ngit+https://github.com/a/b\nnumpy\nPyYAML_Extra~=6.0 # yaml\n";
    expect(parseRequirements(text)).toEqual([
      { name: "django", range: "==4.2.1", dev: false },
      { name: "requests", range: ">=2.31", dev: false },
      { name: "numpy", range: "*", dev: false },
      { name: "pyyaml-extra", range: "~=6.0", dev: false },
    ]);
  });

  it("pyproject.toml (PEP 621 und Poetry)", () => {
    const text = `[project]
name = "x"
dependencies = [
  "fastapi>=0.110",
  "uvicorn[standard]==0.29.0",
]

[project.optional-dependencies]
test = ["pytest>=8"]

[tool.poetry.dependencies]
python = "^3.11"
httpx = "^0.27"
pydantic = { version = "^2.6", extras = ["email"] }

[tool.poetry.group.dev.dependencies]
ruff = "0.4.1"
`;
    expect(parsePyproject(text)).toEqual([
      { name: "fastapi", range: ">=0.110", dev: false },
      { name: "uvicorn", range: "==0.29.0", dev: false },
      { name: "pytest", range: ">=8", dev: true },
      { name: "httpx", range: "^0.27", dev: false },
      { name: "pydantic", range: "^2.6", dev: false },
      { name: "ruff", range: "0.4.1", dev: true },
    ]);
  });
});

describe("Rust, Go, PHP", () => {
  it("Cargo.toml ohne path/git-Abhängigkeiten", () => {
    const text = `[package]
name = "kern"
version = "0.1.0"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = "1.37"
lokal = { path = "../lokal" }

[dev-dependencies]
criterion = "0.5"
`;
    expect(parseCargo(text)).toEqual([
      { name: "serde", range: "1.0", dev: false },
      { name: "tokio", range: "1.37", dev: false },
      { name: "criterion", range: "0.5", dev: true },
    ]);
  });

  it("go.mod mit Block und einzelner Zeile", () => {
    const text = "module example.com/app\n\ngo 1.22\n\nrequire github.com/spf13/cobra v1.8.0\n\nrequire (\n\tgithub.com/BurntSushi/toml v1.3.2\n\tgolang.org/x/sys v0.20.0 // indirect\n)\n";
    expect(parseGoMod(text)).toEqual([
      { name: "github.com/BurntSushi/toml", range: "v1.3.2", dev: false },
      { name: "golang.org/x/sys", range: "v0.20.0", dev: true },
      { name: "github.com/spf13/cobra", range: "v1.8.0", dev: false },
    ]);
    expect(goProxyPath("github.com/BurntSushi/toml")).toBe("github.com/!burnt!sushi/toml");
  });

  it("composer.json ohne php und Erweiterungen", () => {
    const text = JSON.stringify({ require: { php: "^8.2", "ext-json": "*", "laravel/framework": "^11.0" }, "require-dev": { "phpunit/phpunit": "^11" } });
    expect(parseComposer(text)).toEqual([
      { name: "laravel/framework", range: "^11.0", dev: false },
      { name: "phpunit/phpunit", range: "^11", dev: true },
    ]);
  });
});

describe("Gradle und Maven", () => {
  it("build.gradle(.kts)", () => {
    const text = `dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation 'io.ktor:ktor-client-core:2.3.11'
    testImplementation("junit:junit:4.13.2")
    implementation(libs.kotlinx.coroutines)
}`;
    expect(parseGradle(text)).toEqual([
      { name: "com.squareup.okhttp3:okhttp", range: "4.12.0", dev: false },
      { name: "io.ktor:ktor-client-core", range: "2.3.11", dev: false },
      { name: "junit:junit", range: "4.13.2", dev: true },
    ]);
  });

  it("Versionskatalog", () => {
    const text = `[versions]
coroutines = "1.8.1"

[libraries]
kotlinx-coroutines = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-core", version.ref = "coroutines" }
okio = { group = "com.squareup.okio", name = "okio", version = "3.9.0" }
gson = "com.google.code.gson:gson:2.11.0"
`;
    expect(parseVersionCatalog(text)).toEqual([
      { name: "org.jetbrains.kotlinx:kotlinx-coroutines-core", range: "1.8.1", dev: false },
      { name: "com.squareup.okio:okio", range: "3.9.0", dev: false },
      { name: "com.google.code.gson:gson", range: "2.11.0", dev: false },
    ]);
  });

  it("pom.xml mit Properties", () => {
    const text = `<project><properties><jackson.version>2.17.1</jackson.version></properties>
<dependencies>
<dependency><groupId>com.fasterxml.jackson.core</groupId><artifactId>jackson-databind</artifactId><version>\${jackson.version}</version></dependency>
<dependency><groupId>org.junit.jupiter</groupId><artifactId>junit-jupiter</artifactId><version>5.10.2</version><scope>test</scope></dependency>
<dependency><groupId>x</groupId><artifactId>ohne-version</artifactId></dependency>
</dependencies></project>`;
    expect(parsePom(text)).toEqual([
      { name: "com.fasterxml.jackson.core:jackson-databind", range: "2.17.1", dev: false },
      { name: "org.junit.jupiter:junit-jupiter", range: "5.10.2", dev: true },
    ]);
  });
});

describe("Zusammenführen und Links", () => {
  it("dieselbe Angabe nur einmal, mit Herkunft", () => {
    const a = parseManifestFile("package.json", JSON.stringify({ dependencies: { react: "^19.0.0" } }));
    const b = parseManifestFile("apps/web/package.json", JSON.stringify({ dependencies: { react: "^18.0.0", zod: "^3" } }));
    const merged = mergeDeps([a, b], 10);
    expect(merged).toEqual([
      { name: "react", range: "^19.0.0", dev: false, ecosystem: "npm", manifest: "package.json" },
      { name: "zod", range: "^3", dev: false, ecosystem: "npm", manifest: "apps/web/package.json" },
    ]);
    expect(mergeDeps([a, b], 1)).toHaveLength(1);
    expect(parseManifestFile("README.md", "x")).toEqual([]);
  });

  it("Registry-Links je Ökosystem", () => {
    expect(packageUrl(undefined, "react")).toBe("https://www.npmjs.com/package/react");
    expect(packageUrl("PyPI", "django")).toBe("https://pypi.org/project/django/");
    expect(packageUrl("Maven", "junit:junit")).toBe("https://central.sonatype.com/artifact/junit/junit");
    expect(packageUrl("Go", "golang.org/x/sys")).toBe("https://pkg.go.dev/golang.org/x/sys");
  });
});
