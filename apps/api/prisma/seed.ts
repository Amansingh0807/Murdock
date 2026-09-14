import { ClauseType, PrismaClient, RiskLevel } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rawText = "1. Term. This agreement begins on 1 January 2026 and continues for 12 months.\n\n2. Termination. Either party may terminate with 30 days written notice.\n\n3. Late payment. A late fee of 2% per month applies to unpaid amounts.";
  const document = await prisma.document.upsert({
    where: { id: "seed-rental-agreement" },
    update: {},
    create: {
      id: "seed-rental-agreement",
      ownerId: "demo_seed_owner",
      title: "Sample rental agreement",
      sourceName: "sample-rental-agreement.txt",
      rawText,
      parties: { create: [{ name: "Landlord", role: "lessor" }, { name: "Tenant", role: "lessee" }] },
      clauses: {
        create: [
          { rawText: "This agreement begins on 1 January 2026 and continues for 12 months.", startOffset: 9, endOffset: 79, sectionLabel: "1. Term", clauseType: ClauseType.OBLIGATION, riskLevel: RiskLevel.LOW, confidenceScore: 0.98, plainLanguageSummary: "The agreement lasts for one year starting 1 January 2026." },
          { rawText: "Either party may terminate with 30 days written notice.", startOffset: 98, endOffset: 156, sectionLabel: "2. Termination", clauseType: ClauseType.TERMINATION, riskLevel: RiskLevel.MEDIUM, confidenceScore: 0.96, plainLanguageSummary: "Either side can end the agreement if they give 30 days' written notice." },
          { rawText: "A late fee of 2% per month applies to unpaid amounts.", startOffset: 177, endOffset: 232, sectionLabel: "3. Late payment", clauseType: ClauseType.PENALTY, riskLevel: RiskLevel.HIGH, confidenceScore: 0.97, plainLanguageSummary: "Unpaid amounts can accrue a 2% monthly late fee." }
        ]
      }
    }
  });
  console.info(`Seeded ${document.title}`);
}

main().finally(() => prisma.$disconnect());
