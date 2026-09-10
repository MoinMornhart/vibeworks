-- Git-Verbindungen je Konto (GitHub, GitLab, Gitea/Forgejo, selbst gehostet)
CREATE TABLE "GitCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "cipher" TEXT NOT NULL,
    "hint" TEXT NOT NULL,
    "login" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GitCredential_userId_host_key" ON "GitCredential"("userId", "host");

ALTER TABLE "GitCredential" ADD CONSTRAINT "GitCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
