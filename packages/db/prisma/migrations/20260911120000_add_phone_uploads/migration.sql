-- CreateTable
-- Handoff buffer for photos sent from a seller's phone to the sell form open
-- on another device. The desktop polls by sessionId; rows are swept when the
-- seller starts a new session. Additive: nothing deployed reads or writes it yet.
CREATE TABLE "phone_uploads" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "phone_uploads_sessionId_createdAt_idx" ON "phone_uploads"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "phone_uploads_clerkId_createdAt_idx" ON "phone_uploads"("clerkId", "createdAt");
