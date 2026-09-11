-- Heute-Ansicht: Aufgaben, die sich ein Konto für einen Tag vornimmt
CREATE TABLE "TaskFocus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskFocus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskFocus_userId_taskId_day_key" ON "TaskFocus"("userId", "taskId", "day");
CREATE INDEX "TaskFocus_userId_day_idx" ON "TaskFocus"("userId", "day");

ALTER TABLE "TaskFocus" ADD CONSTRAINT "TaskFocus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskFocus" ADD CONSTRAINT "TaskFocus_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
