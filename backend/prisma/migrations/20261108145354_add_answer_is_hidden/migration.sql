-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Answer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "identityTag" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "clientIp" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Answer" ("answer", "clientIp", "id", "identityTag", "questionId", "submittedAt") SELECT "answer", "clientIp", "id", "identityTag", "questionId", "submittedAt" FROM "Answer";
DROP TABLE "Answer";
ALTER TABLE "new_Answer" RENAME TO "Answer";
CREATE INDEX "Answer_questionId_submittedAt_idx" ON "Answer"("questionId", "submittedAt");
CREATE INDEX "Answer_identityTag_submittedAt_idx" ON "Answer"("identityTag", "submittedAt");
CREATE INDEX "Answer_clientIp_questionId_submittedAt_idx" ON "Answer"("clientIp", "questionId", "submittedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
