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
