-- Wünsche pro Tag einstellbar (#48)
ALTER TABLE "Settings" ADD COLUMN "wishLimit" INTEGER NOT NULL DEFAULT 3;
