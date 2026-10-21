-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL,
    "topicZh" TEXT NOT NULL,
    "topicEn" TEXT NOT NULL,
    "titleZh" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "identityTag" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "clientIp" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nameZh" TEXT NOT NULL,
    "nameEn" TEXT,
    "type" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "address" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ServiceTag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nameZh" TEXT NOT NULL,
    "nameEn" TEXT
);

-- CreateTable
CREATE TABLE "InstitutionTagLink" (
    "institutionId" TEXT NOT NULL,
    "tagId" INTEGER NOT NULL,

    PRIMARY KEY ("institutionId", "tagId"),
    CONSTRAINT "InstitutionTagLink_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstitutionTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ServiceTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Question_order_key" ON "Question"("order");

-- CreateIndex
CREATE INDEX "Answer_questionId_submittedAt_idx" ON "Answer"("questionId", "submittedAt");

-- CreateIndex
CREATE INDEX "Answer_identityTag_submittedAt_idx" ON "Answer"("identityTag", "submittedAt");

-- CreateIndex
CREATE INDEX "Answer_clientIp_questionId_submittedAt_idx" ON "Answer"("clientIp", "questionId", "submittedAt");

-- CreateIndex
CREATE INDEX "Institution_province_city_district_idx" ON "Institution"("province", "city", "district");

-- CreateIndex
CREATE INDEX "Institution_type_idx" ON "Institution"("type");

-- CreateIndex
CREATE INDEX "Institution_nameZh_idx" ON "Institution"("nameZh");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTag_nameZh_key" ON "ServiceTag"("nameZh");

-- CreateIndex
CREATE INDEX "InstitutionTagLink_tagId_idx" ON "InstitutionTagLink"("tagId");
