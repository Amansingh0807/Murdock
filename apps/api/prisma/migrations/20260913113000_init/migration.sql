-- CreateEnum
CREATE TYPE "ClauseType" AS ENUM ('OBLIGATION', 'RIGHT', 'RISK', 'TERMINATION', 'PENALTY', 'AMBIGUOUS', 'DEFINITION', 'OTHER');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceName" TEXT,
    "rawText" TEXT NOT NULL,
    "language" TEXT DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clause" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "sectionLabel" TEXT,
    "clauseType" "ClauseType" NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "plainLanguageSummary" TEXT NOT NULL,
    "riskExplanation" TEXT,
    CONSTRAINT "Clause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossReference" (
    "id" TEXT NOT NULL,
    "sourceClauseId" TEXT NOT NULL,
    "targetClauseId" TEXT NOT NULL,
    "label" TEXT,
    CONSTRAINT "CrossReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonSession" (
    "id" TEXT NOT NULL,
    "leftDocumentId" TEXT NOT NULL,
    "rightDocumentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComparisonSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonMatch" (
    "id" TEXT NOT NULL,
    "comparisonSessionId" TEXT NOT NULL,
    "leftClauseId" TEXT,
    "rightClauseId" TEXT,
    "similarityScore" DOUBLE PRECISION,
    "changeSummary" TEXT,
    "favorability" TEXT,
    CONSTRAINT "ComparisonMatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Clause_documentId_clauseType_idx" ON "Clause"("documentId", "clauseType");
CREATE INDEX "Clause_documentId_riskLevel_idx" ON "Clause"("documentId", "riskLevel");
CREATE UNIQUE INDEX "Party_documentId_name_key" ON "Party"("documentId", "name");
CREATE UNIQUE INDEX "CrossReference_sourceClauseId_targetClauseId_key" ON "CrossReference"("sourceClauseId", "targetClauseId");
CREATE INDEX "ComparisonMatch_comparisonSessionId_idx" ON "ComparisonMatch"("comparisonSessionId");

ALTER TABLE "Clause" ADD CONSTRAINT "Clause_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Party" ADD CONSTRAINT "Party_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrossReference" ADD CONSTRAINT "CrossReference_sourceClauseId_fkey" FOREIGN KEY ("sourceClauseId") REFERENCES "Clause"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrossReference" ADD CONSTRAINT "CrossReference_targetClauseId_fkey" FOREIGN KEY ("targetClauseId") REFERENCES "Clause"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComparisonSession" ADD CONSTRAINT "ComparisonSession_leftDocumentId_fkey" FOREIGN KEY ("leftDocumentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComparisonSession" ADD CONSTRAINT "ComparisonSession_rightDocumentId_fkey" FOREIGN KEY ("rightDocumentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComparisonMatch" ADD CONSTRAINT "ComparisonMatch_comparisonSessionId_fkey" FOREIGN KEY ("comparisonSessionId") REFERENCES "ComparisonSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComparisonMatch" ADD CONSTRAINT "ComparisonMatch_leftClauseId_fkey" FOREIGN KEY ("leftClauseId") REFERENCES "Clause"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComparisonMatch" ADD CONSTRAINT "ComparisonMatch_rightClauseId_fkey" FOREIGN KEY ("rightClauseId") REFERENCES "Clause"("id") ON DELETE SET NULL ON UPDATE CASCADE;
