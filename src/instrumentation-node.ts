// Hintergrundaufgaben des Node-Servers – geladen von src/instrumentation.ts.
import { startGitScheduler } from "./lib/git/scheduler";
import { startNotifyScheduler } from "./lib/notify/scheduler";
import { startMonitorScheduler } from "./lib/monitor/scheduler";

startGitScheduler();
startNotifyScheduler();
startMonitorScheduler();
