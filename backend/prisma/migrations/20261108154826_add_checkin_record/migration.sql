-- CreateTable
CREATE TABLE "CheckinRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "institutionId" INTEGER NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CheckinRecord_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CheckinRecord_checkedAt_idx" ON "CheckinRecord"("checkedAt");

-- CreateIndex
CREATE INDEX "CheckinRecord_institutionId_idx" ON "CheckinRecord"("institutionId");
