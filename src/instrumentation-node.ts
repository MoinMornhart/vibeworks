// Hintergrundaufgaben des Node-Servers – geladen von src/instrumentation.ts.
import { startGitScheduler } from "./lib/git/scheduler";
import { startNotifyScheduler } from "./lib/notify/scheduler";
import { startMonitorScheduler } from "./lib/monitor/scheduler";
import { startDemoScheduler } from "./lib/demo";
import { config } from "./lib/config";

startGitScheduler();
startNotifyScheduler();
startMonitorScheduler();
if (config.demoMode) startDemoScheduler();
