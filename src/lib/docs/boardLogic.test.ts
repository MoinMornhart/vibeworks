import { describe, expect, it } from "vitest";
import { boardBounds, BOARD_MAX, BOARD_MAX_ITEMS, boardId, boardPreview, freeSpot, hitsStroke, imageBox, moveItem, newBoardItem, normRotation, parseBoard, resizeItem, rotateItem, serializeBoard, strokeBounds, strokeItem } from "./boardLogic";

describe("Leinwand (#211)", () => {
  it("legt ein neues Element um den Zeigepunkt herum an", () => {
    const zettel = newBoardItem("note", { x: 500, y: 300 }, "a1");
    expect(zettel).toMatchObject({ kind: "note", w: 180, h: 140, color: "yellow", text: "" });
    // Mittig: links und oben um die halbe Größe versetzt
    expect(zettel.x).toBe(410);
    expect(zettel.y).toBe(230);
  });

  it("liest gespeicherte Inhalte tolerant und wirft Unbrauchbares weg", () => {
    const board = parseBoard({
      items: [
        { id: "a", kind: "note", x: 10, y: 20, w: 100, h: 80, text: "Hallo", color: "green" },
        { id: "b", kind: "gibtsnicht", x: 0, y: 0 },
        { kind: "note", x: 0, y: 0 },
        null,
        "quatsch",
        { id: "c", kind: "rect", x: "viel", y: Infinity, w: -50, h: 999999, text: 42, color: "pink" },
      ],
    });
    expect(board.items.map((i) => i.id)).toEqual(["a", "c"]);
    expect(board.items[0]).toEqual({ id: "a", kind: "note", x: 10, y: 20, w: 100, h: 80, text: "Hallo", color: "green" });
    // Unsinnige Werte werden auf Erlaubtes gebracht: Text und Unendlich ergeben den Standard,
    // zu klein und zu groß werden auf die Grenzen gezogen
    expect(board.items[1]).toMatchObject({ x: 0, y: 0, w: 24, h: 4000, text: "", color: "gray" });
  });

  it("nimmt Bilder nur mit brauchbarer Upload-Kennung", () => {
    const board = parseBoard({
      items: [
        { id: "a", kind: "image", x: 0, y: 0, upload: "cmtvgjiz00000hkn8oll4jpir" },
        { id: "b", kind: "image", x: 0, y: 0 },
        { id: "c", kind: "image", x: 0, y: 0, upload: "../../etc/passwd" },
        { id: "d", kind: "image", x: 0, y: 0, upload: "https://fremde.seite/bild.png" },
      ],
    });
    expect(board.items.map((i) => i.id)).toEqual(["a"]);
    expect(board.items[0].upload).toBe("cmtvgjiz00000hkn8oll4jpir");
  });

  it("legt ein Bild mit seiner Kennung an – ohne Kennung bleibt das Feld leer", () => {
    expect(newBoardItem("image", { x: 0, y: 0 }, "x", "cmtvgjiz00000hkn8oll4jpir")).toMatchObject({ w: 260, h: 180, upload: "cmtvgjiz00000hkn8oll4jpir" });
    expect(newBoardItem("image", { x: 0, y: 0 }, "x", "kaputt/pfad").upload).toBeUndefined();
  });

  it("liest auch eine gespeicherte Zeichenkette und verträgt Müll", () => {
    expect(parseBoard('{"items":[{"id":"x","kind":"text","x":1,"y":2}]}').items).toHaveLength(1);
    expect(parseBoard("kein json").items).toEqual([]);
    expect(parseBoard(null).items).toEqual([]);
    expect(parseBoard({ items: "nein" }).items).toEqual([]);
  });

  it("nimmt höchstens die erlaubte Zahl an Elementen", () => {
    const viele = { items: Array.from({ length: BOARD_MAX_ITEMS + 50 }, (_, i) => ({ id: `i${i}`, kind: "note", x: i, y: i })) };
    expect(parseBoard(viele).items).toHaveLength(BOARD_MAX_ITEMS);
  });

  it("behält beim Bild das Seitenverhältnis", () => {
    expect(imageBox(1600, 900)).toEqual({ w: 280, h: 158 });
    expect(imageBox(600, 1200)).toEqual({ w: 140, h: 280 });
    expect(imageBox(40, 40)).toEqual({ w: 280, h: 280 });
    // Unbrauchbare Maße ergeben die Standardgröße
    expect(imageBox(0, 0)).toEqual({ w: 260, h: 180 });
    expect(imageBox(NaN, 100)).toEqual({ w: 260, h: 180 });
  });

  it("weicht freien Platz aus, statt Elemente zu überdecken", () => {
    const a = newBoardItem("note", { x: 300, y: 300 }, "a");
    const b = freeSpot([a], newBoardItem("note", { x: 300, y: 300 }, "b"));
    expect(b.x).toBe(a.x + 24);
    expect(b.y).toBe(a.y + 24);
    const c = freeSpot([a, b], newBoardItem("note", { x: 300, y: 300 }, "c"));
    expect(c.x).toBe(a.x + 48);
    // Freie Stelle bleibt, wo sie ist
    expect(freeSpot([a], newBoardItem("note", { x: 900, y: 900 }, "d")).x).toBe(newBoardItem("note", { x: 900, y: 900 }, "d").x);
  });

  it("verschiebt und vergrößert innerhalb der Grenzen", () => {
    const item = newBoardItem("rect", { x: 100, y: 100 }, "r");
    expect(moveItem(item, 50, -20)).toMatchObject({ x: item.x + 50, y: item.y - 20 });
    // Über den Rand hinaus wird gekappt statt zu verschwinden
    expect(moveItem(item, 999_999, 0).x).toBe(BOARD_MAX);
    expect(resizeItem(item, -999, -999)).toMatchObject({ w: 24, h: 24 });
    expect(resizeItem(item, 100, 60)).toMatchObject({ w: 300, h: 200 });
  });

  it("speichert und liest denselben Inhalt wieder ein", () => {
    const items = [newBoardItem("note", { x: 0, y: 0 }, boardId()), newBoardItem("ellipse", { x: 400, y: 100 }, boardId())];
    expect(parseBoard(serializeBoard(items)).items).toEqual(items);
  });

  it("gibt jedem Element eine eigene Kennung", () => {
    const ids = new Set(Array.from({ length: 50 }, () => boardId()));
    expect(ids.size).toBe(50);
    expect([...ids].every((id) => /^[0-9a-f]{16}$/.test(id))).toBe(true);
  });

  it("nennt die Fläche, in der alles liegt – fürs Einpassen", () => {
    expect(boardBounds([])).toBeNull();
    const items = [newBoardItem("note", { x: 200, y: 200 }, "a"), newBoardItem("rect", { x: 600, y: 400 }, "b")];
    const b = boardBounds(items)!;
    expect(b.x).toBe(Math.min(items[0].x, items[1].x));
    expect(b.w).toBeGreaterThan(300);
  });
});

describe("Freihand (#211 Schritt 3)", () => {
  it("macht aus gezeichneten Punkten ein Element mit eigenem Rahmen", () => {
    const strich = strokeItem([{ x: 100, y: 100 }, { x: 140, y: 130 }, { x: 180, y: 100 }], "s1", "blue", 4)!;
    expect(strich.kind).toBe("ink");
    // Der Rahmen bekommt die Strichstärke als Luft – links/oben abgezogen, rechts/unten dazu
    expect(strich.x).toBe(96);
    expect(strich.y).toBe(96);
    expect(strich.w).toBe(88);
    expect(strich.points).toEqual([4, 4, 44, 34, 84, 4]);
    expect(strich.size).toBe(4);
  });

  it("wirft ein bloßes Tippen weg", () => {
    expect(strokeItem([{ x: 10, y: 10 }], "s2", "red", 4)).toBeNull();
    expect(strokeItem([], "s3", "red", 4)).toBeNull();
  });

  it("liest Striche streng ein – kaputte Punkte fallen weg", () => {
    const gut = { id: "a", kind: "ink", x: 0, y: 0, w: 100, h: 50, points: [0, 0, 50, 25, 100, 50], size: 8, marker: true };
    const board = parseBoard({
      items: [
        gut,
        { id: "b", kind: "ink", x: 0, y: 0, points: [1, 2] },
        { id: "c", kind: "ink", x: 0, y: 0, points: ["hier", 2, 3, 4] },
        { id: "d", kind: "ink", x: 0, y: 0 },
      ],
    });
    expect(board.items.map((i) => i.id)).toEqual(["a"]);
    expect(board.items[0]).toMatchObject({ points: [0, 0, 50, 25, 100, 50], size: 8, marker: true });
  });

  it("findet den Strich unter dem Radierer – und lässt Entferntes in Ruhe", () => {
    const strich = strokeItem([{ x: 200, y: 200 }, { x: 300, y: 200 }], "s4", "red", 4)!;
    expect(hitsStroke(strich, 250, 200, 6)).toBe(true);
    expect(hitsStroke(strich, 250, 260, 6)).toBe(false);
    // Andere Arten trifft der Radierer nicht
    expect(hitsStroke(newBoardItem("note", { x: 250, y: 200 }, "n"), 250, 200, 6)).toBe(false);
  });

  it("nennt den Maßstab eines Strichs", () => {
    expect(strokeBounds([0, 0, 30, 60])).toEqual({ w: 30, h: 60 });
    expect(strokeBounds([])).toEqual({ w: 1, h: 1 });
  });
});

describe("Drehen (#211)", () => {
  const box = { ...newBoardItem("text", { x: 0, y: 0 }, "t"), x: 0, y: 0, w: 200, h: 100 };

  it("bringt jede Drehung auf ganze Grad zwischen -180 und 179", () => {
    expect(normRotation(0)).toBe(0);
    expect(normRotation(45.4)).toBe(45);
    expect(normRotation(180)).toBe(-180);
    expect(normRotation(270)).toBe(-90);
    expect(normRotation(-450)).toBe(-90);
    expect(normRotation(720)).toBe(0);
    expect(normRotation("90")).toBe(0);
    expect(normRotation(Number.NaN)).toBe(0);
    expect(normRotation(Infinity)).toBe(0);
  });

  it("liest die Drehung ein und lässt sie bei 0 ganz weg", () => {
    const raw = JSON.stringify({ items: [{ ...box, rotation: 450 }, { ...box, id: "u", rotation: 0 }, { ...box, id: "v", rotation: "schräg" }] });
    const [a, b, c] = parseBoard(raw).items;
    expect(a.rotation).toBe(90);
    expect("rotation" in b).toBe(false);
    expect("rotation" in c).toBe(false);
    // Hin und zurück bleibt die Drehung erhalten
    expect(parseBoard(serializeBoard([a])).items[0].rotation).toBe(90);
  });

  it("dreht über den Griff: Zeiger rechts der Mitte heißt 90 Grad", () => {
    // Mitte liegt bei 100/50
    expect(rotateItem(box, 300, 50).rotation).toBe(90);
    expect(rotateItem(box, 100, 300).rotation).toBe(-180);
    expect(rotateItem(box, -100, 50).rotation).toBe(-90);
    // Genau über der Mitte: keine Drehung, das Feld fällt weg
    expect("rotation" in rotateItem({ ...box, rotation: 30 }, 100, -200)).toBe(false);
  });

  it("rastet nahe an rechten Winkeln ein und dreht mit Schritt in Stufen", () => {
    // 3 Grad neben 90 → 90
    const p = (deg: number) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return [100 + Math.cos(rad) * 200, 50 + Math.sin(rad) * 200] as const;
    };
    expect(rotateItem(box, ...p(93)).rotation).toBe(90);
    expect(rotateItem(box, ...p(37)).rotation).toBe(37);
    expect(rotateItem(box, ...p(37), 15).rotation).toBe(30);
    // Zeiger genau auf der Mitte ändert nichts
    expect(rotateItem({ ...box, rotation: 12 }, 100, 50).rotation).toBe(12);
  });

  it("vergrößert ein gedrehtes Element entlang seiner Kanten und hält die Ecke fest", () => {
    const gedreht = { ...box, rotation: 90 };
    // Bei 90 Grad zeigt die eigene Breite nach unten: 50 nach unten macht es 50 breiter
    const r = resizeItem(gedreht, 0, 50);
    expect(r).toMatchObject({ w: 250, h: 100 });
    // Die gedrehte linke obere Ecke liegt vorher und nachher an derselben Stelle
    const ecke = (i: typeof r) => {
      const rad = ((i.rotation ?? 0) * Math.PI) / 180;
      const cx = i.x + i.w / 2;
      const cy = i.y + i.h / 2;
      return [Math.round(cx - (i.w / 2) * Math.cos(rad) + (i.h / 2) * Math.sin(rad)), Math.round(cy - (i.w / 2) * Math.sin(rad) - (i.h / 2) * Math.cos(rad))];
    };
    expect(ecke(r)).toEqual(ecke(gedreht));
    // Ohne Drehung bleibt alles wie bisher
    expect(resizeItem(box, 20, 10)).toMatchObject({ x: 0, y: 0, w: 220, h: 110 });
  });

  it("rechnet die Drehung in den Rahmen fürs Einpassen ein", () => {
    const quer = { ...box, rotation: 90 };
    const b = boardBounds([quer])!;
    expect(b).toEqual({ x: 50, y: -50, w: 100, h: 200 });
  });

  it("trifft mit dem Radierer auch einen gedrehten Strich", () => {
    const strich = strokeItem([{ x: 0, y: 50 }, { x: 200, y: 50 }], "s", "blue", 4)!;
    const senkrecht = { ...strich, rotation: 90 };
    const mitte = { x: strich.x + strich.w / 2, y: strich.y + strich.h / 2 };
    // Über der Mitte liegt der gedrehte Strich, rechts davon nicht mehr
    expect(hitsStroke(senkrecht, mitte.x, mitte.y - 80, 6)).toBe(true);
    expect(hitsStroke(senkrecht, mitte.x + 80, mitte.y, 6)).toBe(false);
    expect(hitsStroke(strich, mitte.x + 80, mitte.y, 6)).toBe(true);
  });
});

describe("Vorschau für die Übersicht (#211)", () => {
  it("passt den Inhalt in einen Rahmen mit Breite 100", () => {
    expect(boardPreview({ items: [] })).toEqual({ height: 60, shapes: [], count: 0 });
    const items = [
      { ...newBoardItem("note", { x: 0, y: 0 }, "a"), x: 0, y: 0, w: 100, h: 100 },
      { ...newBoardItem("rect", { x: 0, y: 0 }, "b"), x: 900, y: 0, w: 100, h: 100, rotation: 45 },
    ];
    const p = boardPreview({ items });
    expect(p.count).toBe(2);
    expect(p.height).toBe(30);
    for (const s of p.shapes) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x + s.w).toBeLessThanOrEqual(100);
    }
    expect(p.shapes[1].rotation).toBe(45);
    // Text bleibt draußen
    expect(JSON.stringify(p)).not.toContain("text");
  });

  it("zeigt höchstens 120 Formen, zählt aber alle", () => {
    const items = Array.from({ length: 300 }, (_, n) => newBoardItem("rect", { x: n * 10, y: 0 }, `r${n}`));
    const p = boardPreview({ items });
    expect(p.shapes).toHaveLength(120);
    expect(p.count).toBe(300);
  });
});
