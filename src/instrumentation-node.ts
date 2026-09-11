// Hintergrundaufgaben des Node-Servers – geladen von src/instrumentation.ts.
import { startGitScheduler } from "./lib/git/scheduler";
import { startNotifyScheduler } from "./lib/notify/scheduler";

startGitScheduler();
startNotifyScheduler();
