// Berichts-Modi einer Discord-Verbindung (#105) – ohne Node-Abhängigkeiten, auch für die Oberfläche.
export const REPORT_MODES = ["off", "daily", "weekly"] as const;
export type ReportMode = (typeof REPORT_MODES)[number];
