-- Community: vorgestellte Projekte, Beiträge, Antworten, Meldungen und Sperren
ALTER TABLE "Project" ADD COLUMN "inCommunity" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "communityBannedAt" TIMESTAMP(3),
ADD COLUMN "communityBanReason" TEXT;

CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'question',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityReply" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityReply_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityReport" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityBan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityBan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunityPost_projectId_lastActivityAt_idx" ON "CommunityPost"("projectId", "lastActivityAt");
CREATE INDEX "CommunityReply_postId_createdAt_idx" ON "CommunityReply"("postId", "createdAt");
CREATE INDEX "CommunityReport_status_createdAt_idx" ON "CommunityReport"("status", "createdAt");
CREATE INDEX "CommunityReport_projectId_status_idx" ON "CommunityReport"("projectId", "status");
CREATE UNIQUE INDEX "CommunityReport_targetType_targetId_reporterId_key" ON "CommunityReport"("targetType", "targetId", "reporterId");
CREATE UNIQUE INDEX "CommunityBan_projectId_userId_key" ON "CommunityBan"("projectId", "userId");

ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityReply" ADD CONSTRAINT "CommunityReply_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityReply" ADD CONSTRAINT "CommunityReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityBan" ADD CONSTRAINT "CommunityBan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
