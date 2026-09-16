import type { Shape } from "../types";

// Namensraum „onboarding“: erste Schritte auf dem Dashboard (#100).

const de = {
  title: "Erste Schritte",
  progress: "{done} von {total} erledigt",
  hideDone: "{n} Erledigte ausblenden",
  showDone: "Erledigte zeigen",
  dismiss: "Liste schließen",
  dismissed: "Liste geschlossen – unter Konto lässt sie sich wieder einblenden.",
  allDone: "Alles eingerichtet – stark!",
  steps: {
    git: { title: "Git-Zugang verbinden", hint: "GitHub, GitLab oder Gitea – dann kommen Repositories als Projekte." },
    repoProject: { title: "Projekt mit Repository", hint: "Commits, CI, Issues und Code-Netz brauchen ein verknüpftes Repository." },
    apiKey: { title: "KI anbinden (MCP)", hint: "API-Schlüssel erstellen und per Einzeiler in Claude Code eintragen." },
    rules: { title: "Regeln für die KI bestätigt", hint: "Die KI holt die Regeln einmal und bestätigt sie – der Einzeiler macht das mit." },
    bot: { title: "Bot für Issues", hint: "„Bot per Klick“ – Issues erscheinen dann nicht unter deinem Namen." },
    secondFactor: { title: "Konto absichern", hint: "Passkey oder Authenticator-App als zweiten Faktor einrichten." },
    notify: { title: "Benachrichtigungen empfangen", hint: "ntfy, Webhook oder E-Mail – damit Wichtiges dich erreicht." },
    errorInbox: { title: "Fehler-Eingang einschalten", hint: "Deine Apps melden Laufzeitfehler direkt an VibeWorks." },
    team: { title: "Team", hint: "Gemeinsam an Projekten arbeiten – Team anlegen oder beitreten." },
  },
  restore: "Erste Schritte wieder zeigen",
};

const en: Shape<typeof de> = {
  title: "Getting started",
  progress: "{done} of {total} done",
  hideDone: "Hide {n} done",
  showDone: "Show done",
  dismiss: "Close list",
  dismissed: "List closed – you can show it again under Account.",
  allDone: "All set up – great!",
  steps: {
    git: { title: "Connect Git access", hint: "GitHub, GitLab or Gitea – your repositories then become projects." },
    repoProject: { title: "Project with repository", hint: "Commits, CI, issues and the code network need a linked repository." },
    apiKey: { title: "Connect your AI (MCP)", hint: "Create an API key and add it to Claude Code with the one-liner." },
    rules: { title: "AI rules confirmed", hint: "The AI fetches the rules once and confirms them – the one-liner does that too." },
    bot: { title: "Bot for issues", hint: "“Create bot in one click” – issues then don't appear under your name." },
    secondFactor: { title: "Secure your account", hint: "Set up a passkey or authenticator app as second factor." },
    notify: { title: "Receive notifications", hint: "ntfy, webhook or email – so important things reach you." },
    errorInbox: { title: "Turn on the error inbox", hint: "Your apps report runtime errors straight to VibeWorks." },
    team: { title: "Team", hint: "Work on projects together – create or join a team." },
  },
  restore: "Show getting started again",
};

export default { de, en };
