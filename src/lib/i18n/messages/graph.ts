import type { Shape } from "../types";
import { plural } from "../translate";

// Namensraum „graph“: Code-Netz („Synapsen“) auf der Projektseite (#57).

const de = {
  title: "Code-Netz",
  hint: "Wie die Dateien des Repositories zusammenhängen: jeder Punkt eine Datei oder ein Paket, jede Linie ein Import. Berechnet aus der Kopie, die VibeWorks ohnehin holt – ohne KI und ohne Kosten.",
  load: "Netz anzeigen",
  loading: "Baue das Netz …",
  reload: "Neu laden",
  empty: "Noch keine Kopie des Repositories – einmal „Abgleichen“ unter Git & Updates, dann klappt es.",
  stats: plural("{files} Datei · {links} Verbindungen", "{files} Dateien · {links} Verbindungen"),
  hidden: plural("{n} weniger verbundene Datei ausgeblendet", "{n} weniger verbundene Dateien ausgeblendet"),
  search: "Datei suchen …",
  packages: "Pakete",
  help: "Ziehen verschiebt, Mausrad zoomt, Klick zeigt die Verbindungen.",
  fit: "Einpassen",
  imports: plural("Nutzt {n} Datei/Paket", "Nutzt {n} Dateien/Pakete"),
  importedBy: plural("Genutzt von {n} Datei", "Genutzt von {n} Dateien"),
  none: "–",
  openFile: "Im Repository öffnen",
  package: "Paket",
  close: "Auswahl aufheben",
  only: "Nur diesen Bereich zeigen",
  all: "Alle Bereiche",
};

const en: Shape<typeof de> = {
  title: "Code network",
  hint: "How the repository's files connect: each dot is a file or package, each line an import. Computed from the copy VibeWorks fetches anyway – no AI, no cost.",
  load: "Show network",
  loading: "Building the network …",
  reload: "Reload",
  empty: "No copy of the repository yet – run “Sync” under Git & updates once, then it works.",
  stats: plural("{files} file · {links} connections", "{files} files · {links} connections"),
  hidden: plural("{n} less connected file hidden", "{n} less connected files hidden"),
  search: "Search file …",
  packages: "Packages",
  help: "Drag to move, scroll to zoom, click to see connections.",
  fit: "Fit",
  imports: plural("Uses {n} file/package", "Uses {n} files/packages"),
  importedBy: plural("Used by {n} file", "Used by {n} files"),
  none: "–",
  openFile: "Open in repository",
  package: "Package",
  close: "Clear selection",
  only: "Show only this area",
  all: "All areas",
};

export default { de, en };
