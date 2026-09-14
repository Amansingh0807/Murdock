-- Run in Supabase SQL Editor only AFTER enabling the Clerk third-party auth
-- integration. This uses Clerk's JWT `sub` claim as the document owner id.
-- The Express API separately verifies ownership before every resource action.
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Clause" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Party" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrossReference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComparisonSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComparisonMatch" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_owner_only" ON "Document" FOR ALL TO authenticated
  USING ((select auth.jwt() ->> 'sub') = "ownerId")
  WITH CHECK ((select auth.jwt() ->> 'sub') = "ownerId");

CREATE POLICY "clause_document_owner_only" ON "Clause" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM "Document" d WHERE d.id = "Clause"."documentId" AND (select auth.jwt() ->> 'sub') = d."ownerId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Document" d WHERE d.id = "Clause"."documentId" AND (select auth.jwt() ->> 'sub') = d."ownerId"));

CREATE POLICY "party_document_owner_only" ON "Party" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM "Document" d WHERE d.id = "Party"."documentId" AND (select auth.jwt() ->> 'sub') = d."ownerId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Document" d WHERE d.id = "Party"."documentId" AND (select auth.jwt() ->> 'sub') = d."ownerId"));

CREATE POLICY "cross_reference_owner_only" ON "CrossReference" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM "Clause" c JOIN "Document" d ON d.id = c."documentId" WHERE c.id = "CrossReference"."sourceClauseId" AND (select auth.jwt() ->> 'sub') = d."ownerId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Clause" c JOIN "Document" d ON d.id = c."documentId" WHERE c.id = "CrossReference"."sourceClauseId" AND (select auth.jwt() ->> 'sub') = d."ownerId"));

CREATE POLICY "comparison_owner_only" ON "ComparisonSession" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM "Document" d WHERE d.id = "ComparisonSession"."leftDocumentId" AND (select auth.jwt() ->> 'sub') = d."ownerId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Document" d WHERE d.id = "ComparisonSession"."leftDocumentId" AND (select auth.jwt() ->> 'sub') = d."ownerId"));

CREATE POLICY "comparison_match_owner_only" ON "ComparisonMatch" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM "ComparisonSession" s JOIN "Document" d ON d.id = s."leftDocumentId" WHERE s.id = "ComparisonMatch"."comparisonSessionId" AND (select auth.jwt() ->> 'sub') = d."ownerId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "ComparisonSession" s JOIN "Document" d ON d.id = s."leftDocumentId" WHERE s.id = "ComparisonMatch"."comparisonSessionId" AND (select auth.jwt() ->> 'sub') = d."ownerId"));
