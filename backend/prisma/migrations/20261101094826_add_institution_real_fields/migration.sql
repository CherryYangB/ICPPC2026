/*
  Warnings:

  - You are about to drop the `InstitutionTagLink` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ServiceTag` table. If the table is not empty, all the data it contains will be lost.
  - The primary key for the `Institution` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `district` on the `Institution` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Institution` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `Institution` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - Added the required column `latitude` to the `Institution` table without a default value. This is not possible if the table is not empty.
  - Added the required column `longitude` to the `Institution` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "InstitutionTagLink_tagId_idx";

-- DropIndex
DROP INDEX "ServiceTag_nameZh_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "InstitutionTagLink";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ServiceTag";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Institution" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "nameEn" TEXT,
    "hasWard" BOOLEAN NOT NULL DEFAULT false,
    "hasClinic" BOOLEAN NOT NULL DEFAULT false,
    "wardProjects" JSONB NOT NULL DEFAULT [],
    "clinicDepartments" JSONB NOT NULL DEFAULT [],
    "typeTags" JSONB NOT NULL DEFAULT [],
    "longitude" REAL NOT NULL,
    "latitude" REAL NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "isLit" BOOLEAN NOT NULL DEFAULT false,
    "litAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Institution" ("address", "city", "createdAt", "description", "descriptionEn", "id", "nameEn", "nameZh", "province", "updatedAt") SELECT "address", "city", "createdAt", "description", "descriptionEn", "id", "nameEn", "nameZh", "province", "updatedAt" FROM "Institution";
DROP TABLE "Institution";
ALTER TABLE "new_Institution" RENAME TO "Institution";
CREATE INDEX "Institution_province_idx" ON "Institution"("province");
CREATE UNIQUE INDEX "Institution_province_city_nameZh_key" ON "Institution"("province", "city", "nameZh");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
