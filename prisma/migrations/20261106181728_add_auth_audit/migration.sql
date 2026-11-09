-- CreateTable
CREATE TABLE "AuthAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthAudit_userId_idx" ON "AuthAudit"("userId");

-- CreateIndex
CREATE INDEX "AuthAudit_createdAt_idx" ON "AuthAudit"("createdAt");

-- AddForeignKey
ALTER TABLE "AuthAudit" ADD CONSTRAINT "AuthAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
