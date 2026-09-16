import { describe, expect, it } from "vitest";
import { buildCodeGraph, importOf, neighborsOf, packageOf, resolveImport } from "./codeGraphLogic";

const files = ["src/lib/a.ts", "src/lib/b/index.ts", "src/app/page.tsx", "src/components/C.tsx", "scripts/run.mjs", "tool/main.py", "tool/util.py", "tool/pkg/__init__.py", "README.md"];
const set = new Set(files);

describe("Code-Netz", () => {
  it("liest Import-Zeilen in JS/TS und Python", () => {
    expect(importOf('import { x } from "./a";', "src/lib/c.ts")).toBe("./a");
    expect(importOf("export * from '@/lib/a'", "src/x.ts")).toBe("@/lib/a");
    expect(importOf('const m = await import("./lazy")', "src/x.ts")).toBe("./lazy");
    expect(importOf('const fs = require("fs")', "x.cjs")).toBe("fs");
    expect(importOf('import "./styles.css"', "src/x.ts")).toBe("./styles.css");
    expect(importOf("// import x from 'y'", "src/x.ts")).toBeNull();
    expect(importOf("from .util import helper", "tool/main.py")).toBe(".util");
    expect(importOf("import requests", "tool/main.py")).toBe("requests");
    expect(importOf("const a = 1", "src/x.ts")).toBeNull();
  });

  it("löst Pfade, Alias, index-Dateien und Pakete auf", () => {
    expect(resolveImport("./a", "src/lib/c.ts", set)).toEqual({ file: "src/lib/a.ts" });
    expect(resolveImport("@/lib/b", "src/app/page.tsx", set)).toEqual({ file: "src/lib/b/index.ts" });
    expect(resolveImport("../lib/a.js", "src/app/page.tsx", set)).toEqual({ file: "src/lib/a.ts" });
    expect(resolveImport("@scope/pkg/sub", "src/x.ts", set)).toEqual({ pkg: "@scope/pkg" });
    expect(resolveImport("node:fs", "src/x.ts", set)).toBeNull();
    expect(resolveImport("./fehlt", "src/x.ts", set)).toBeNull();
    expect(resolveImport(".util", "tool/main.py", set)).toEqual({ file: "tool/util.py" });
    expect(resolveImport("tool.pkg", "tool/main.py", set)).toEqual({ file: "tool/pkg/__init__.py" });
    expect(resolveImport("requests", "tool/main.py", set)).toEqual({ pkg: "requests" });
    expect(packageOf("react-dom/client")).toBe("react-dom");
    expect(resolveImport(" className=", "src/x.tsx", set)).toBeNull();
  });

  it("baut das Netz aus der git-grep-Ausgabe", () => {
    const out = [
      'refs/heads/main:src/app/page.tsx:1:import { a } from "@/lib/a";',
      'refs/heads/main:src/app/page.tsx:2:import C from "@/components/C";',
      'refs/heads/main:src/app/page.tsx:3:import { useState } from "react";',
      'refs/heads/main:src/components/C.tsx:1:import { useState } from "react";',
      'refs/heads/main:src/components/C.tsx:2:import { a } from "../lib/a";',
      'refs/heads/main:src/components/C.tsx:3:import { a as b } from "../lib/a";',
      "refs/heads/main:tool/main.py:1:from .util import helper",
      'refs/heads/main:README.md:1:import x from "y"',
    ].join("\n");
    const g = buildCodeGraph(out, files);
    expect(g.edges).toHaveLength(6); // doppelter Import von a zählt einmal, dazu main.py → util.py
    expect(g.nodes.find((n) => n.id === "pkg:react")).toMatchObject({ kind: "package", label: "react", degree: 2 });
    expect(g.nodes.find((n) => n.id === "src/lib/a.ts")).toMatchObject({ kind: "file", group: "src/lib", degree: 2 });
    expect(neighborsOf(g, "src/lib/a.ts").importedBy.sort()).toEqual(["src/app/page.tsx", "src/components/C.tsx"]);
    expect(g.files).toBe(8);
  });
});

describe("weitere Sprachen (#98)", () => {
  const more = new Set([
    "app/src/main/java/com/demo/app/MainActivity.kt",
    "app/src/main/java/com/demo/app/ui/Screen.kt",
    "app/src/main/java/com/demo/app/util/Strings.kt",
    "lib/src/main/java/org/x/Tool.java",
    "cmd/server/main.go",
    "internal/store/store.go",
    "native/src/jni.c",
    "native/src/jni.h",
    "native/include/util.h",
    "core/src/lib.rs",
    "core/src/net.rs",
    "core/src/net/client.rs",
    "scripts/build.sh",
    "scripts/common.sh",
  ]);
  it("liest Import-Zeilen", () => {
    expect(importOf("import com.demo.app.ui.Screen", "a/B.kt")).toBe("com.demo.app.ui.Screen");
    expect(importOf("import androidx.compose.runtime.*", "a/B.kt")).toBe("androidx.compose.runtime.*");
    expect(importOf("import static org.x.Tool.run;", "a/B.java")).toBe("org.x.Tool.run");
    expect(importOf('"example.com/app/internal/store"', "cmd/server/main.go")).toBe("example.com/app/internal/store");
    expect(importOf('import str "strings"', "cmd/server/main.go")).toBe("strings");
    expect(importOf('#include "jni.h"', "native/src/jni.c")).toBe("jni.h");
    expect(importOf("#include <stdio.h>", "native/src/jni.c")).toBeNull();
    expect(importOf("pub mod net;", "core/src/lib.rs")).toBe("mod:net");
    expect(importOf("use crate::net::client::Client;", "core/src/lib.rs")).toBe("crate::net::client::Client");
    expect(importOf("source ./common.sh", "scripts/build.sh")).toBe("./common.sh");
  });
  it("löst Dateien und Pakete auf", () => {
    expect(resolveImport("com.demo.app.ui.Screen", "app/src/main/java/com/demo/app/MainActivity.kt", more)).toEqual({ file: "app/src/main/java/com/demo/app/ui/Screen.kt" });
    expect(resolveImport("com.demo.app.util.Strings.capitalize", "app/src/main/java/com/demo/app/MainActivity.kt", more)).toEqual({ file: "app/src/main/java/com/demo/app/util/Strings.kt" });
    expect(resolveImport("com.demo.app.ui.*", "app/src/main/java/com/demo/app/MainActivity.kt", more)).toEqual({ file: "app/src/main/java/com/demo/app/ui/Screen.kt" });
    expect(resolveImport("androidx.compose.runtime.*", "app/src/main/java/com/demo/app/MainActivity.kt", more)).toEqual({ pkg: "androidx.compose" });
    expect(resolveImport("kotlin.math.max", "app/src/main/java/com/demo/app/MainActivity.kt", more)).toBeNull();
    expect(resolveImport("example.com/app/internal/store", "cmd/server/main.go", more)).toEqual({ file: "internal/store/store.go" });
    expect(resolveImport("fmt", "cmd/server/main.go", more)).toBeNull();
    expect(resolveImport("github.com/spf13/cobra/doc", "cmd/server/main.go", more)).toEqual({ pkg: "github.com/spf13/cobra" });
    expect(resolveImport("jni.h", "native/src/jni.c", more)).toEqual({ file: "native/src/jni.h" });
    expect(resolveImport("util.h", "native/src/jni.c", more)).toEqual({ file: "native/include/util.h" });
    expect(resolveImport("mod:net", "core/src/lib.rs", more)).toEqual({ file: "core/src/net.rs" });
    expect(resolveImport("crate::net::client::Client", "core/src/lib.rs", more)).toEqual({ file: "core/src/net/client.rs" });
    expect(resolveImport("serde::Deserialize", "core/src/lib.rs", more)).toEqual({ pkg: "serde" });
    expect(resolveImport("std::io", "core/src/lib.rs", more)).toBeNull();
    expect(resolveImport("./common.sh", "scripts/build.sh", more)).toEqual({ file: "scripts/common.sh" });
  });
  it("zählt Kotlin-Dateien im Netz", () => {
    const out = "refs/heads/main:app/src/main/java/com/demo/app/MainActivity.kt:3:import com.demo.app.ui.Screen";
    const g = buildCodeGraph(out, [...more]);
    expect(g.files).toBe(more.size);
    expect(g.edges).toEqual([{ source: "app/src/main/java/com/demo/app/MainActivity.kt", target: "app/src/main/java/com/demo/app/ui/Screen.kt" }]);
  });
});
