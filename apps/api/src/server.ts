import "dotenv/config";
import { clerkMiddleware, getAuth } from "@clerk/express";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import mammoth from "mammoth";
import multer from "multer";
import pdf from "pdf-parse";
import { z } from "zod";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
type ClauseType = "OBLIGATION" | "RIGHT" | "RISK" | "TERMINATION" | "PENALTY" | "AMBIGUOUS" | "DEFINITION" | "OTHER";
type Clause = { id:string; sectionLabel:string; rawText:string; startOffset:number; endOffset:number; clauseType:ClauseType; riskLevel:RiskLevel; confidenceScore:number; plainLanguageSummary:string; riskExplanation?:string };
type DocumentGraph = { id:string; ownerId:string; title:string; rawText:string; clauses:Clause[]; createdAt:string };

const documents = new Map<string, DocumentGraph>();
const port = Number(process.env.PORT ?? 4000);
const authRequired = process.env.AUTH_REQUIRED === "true" || process.env.NODE_ENV === "production";
const allowedOrigins = new Set((process.env.ALLOWED_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean));
if (authRequired && !process.env.CLERK_SECRET_KEY) throw new Error("CLERK_SECRET_KEY is required when authentication is enabled.");
const upload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 0 },
});
const app = express();
app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" }, frameguard: { action: "deny" }, referrerPolicy: { policy: "strict-origin-when-cross-origin" }, hsts: { maxAge: 31536000, includeSubDomains: true } }));
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin.replace(/\/$/, ""))), methods: ["GET", "POST"], allowedHeaders: ["Content-Type", "Authorization"], maxAge: 86400 }));
app.use(express.json({ limit: "32kb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: "draft-7", legacyHeaders: false }));
if (authRequired) app.use(clerkMiddleware());
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false });

function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!authRequired) { res.locals.userId = "local_demo_user"; return next(); }
  const { isAuthenticated, userId } = getAuth(req);
  if (!isAuthenticated || !userId) return res.status(401).json({ error: "Sign in is required." });
  res.locals.userId = userId;
  return next();
}
const uid = () => `doc_${crypto.randomUUID()}`;
function cleanText(value: string) { return value.replace(/\u0000/g, "").slice(0, 500_000); }
function ownedDocument(id: string, ownerId: string) { const document = documents.get(id); return document?.ownerId === ownerId ? document : undefined; }
function classify(text:string):Pick<Clause,"clauseType"|"riskLevel"|"plainLanguageSummary"|"riskExplanation"> { const t=text.toLowerCase(); if(/terminat|cancel|end this agreement/.test(t)) return {clauseType:"TERMINATION",riskLevel:"MEDIUM",plainLanguageSummary:"This section sets out how the agreement can end and what notice may be needed.",riskExplanation:"Ending rights or notice periods can affect how quickly either side can leave the arrangement."}; if(/penalt|late fee|interest|fine|liquidated damages/.test(t)) return {clauseType:"PENALTY",riskLevel:"HIGH",plainLanguageSummary:"This section may require an extra payment or other consequence if a condition is not met.",riskExplanation:"Financial consequences can increase the cost of non-compliance; check the amount and trigger carefully."}; if(/must|shall|required to|responsible for/.test(t)) return {clauseType:"OBLIGATION",riskLevel:"LOW",plainLanguageSummary:"This section describes something a party is expected to do."}; if(/may|entitled|right to/.test(t)) return {clauseType:"RIGHT",riskLevel:"LOW",plainLanguageSummary:"This section describes an option or right available to a party."}; if(/undefined|reasonable|sole discretion|as necessary/.test(t)) return {clauseType:"AMBIGUOUS",riskLevel:"MEDIUM",plainLanguageSummary:"This section uses language that may need clarification because its limits are not specific.",riskExplanation:"Broad or undefined wording can be interpreted differently by the parties."}; return {clauseType:"OTHER",riskLevel:"LOW",plainLanguageSummary:"This section states a term of the agreement."}; }
function extractGraph(ownerId:string, title:string, rawText:string):DocumentGraph { const text=cleanText(rawText);const units=text.split(/\n\s*\n|(?=\n?\s*(?:\d+[.)]|[A-Z][A-Z\s]{3,}:))/).map(s=>s.trim()).filter(Boolean).slice(0,250);let cursor=0;const clauses=units.map((raw,index)=>{const start=text.indexOf(raw,cursor);cursor=start+raw.length;const sectionLabel=raw.match(/^(\d+[.)][^\n]{0,80}|[A-Z][A-Z\s]{3,}:)/)?.[1]??`Section ${index+1}`;return {id:`cl_${crypto.randomUUID()}`,sectionLabel,rawText:raw,startOffset:start,endOffset:start+raw.length,confidenceScore:.92,...classify(raw)}});return {id:uid(),ownerId,title:title.slice(0,180),rawText:text,clauses,createdAt:new Date().toISOString()}; }
function isPlainText(buffer: Buffer) { try { new TextDecoder("utf-8", { fatal: true }).decode(buffer); } catch { return false; } const sample = buffer.subarray(0, 4096); const controls = [...sample].filter((byte) => byte < 9 || (byte > 13 && byte < 32)).length; return controls / Math.max(sample.length, 1) < 0.01; }
function fileExtension(file:Express.Multer.File) { return file.originalname.toLowerCase().split(".").pop() ?? ""; }
async function fileText(file:Express.Multer.File){
  if (!file.buffer.length) throw new Error("The uploaded file is empty.");
  const extension = fileExtension(file);
  const isPdf = extension === "pdf" || file.buffer.subarray(0, 4).equals(Buffer.from("%PDF"));
  const isDocx = extension === "docx" || (file.buffer[0] === 0x50 && file.buffer[1] === 0x4b);
  if (isPdf) return (await pdf(file.buffer)).text;
  if (isDocx) return (await mammoth.extractRawText({buffer:file.buffer})).value;
  if (extension === "txt" || isPlainText(file.buffer)) return file.buffer.toString("utf8");
  throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
}
function sampleText(){return `1. TERM\nThis agreement begins on 1 January 2026 and continues for 12 months.\n\n2. TERMINATION\nEither party may terminate this agreement with 30 days written notice.\n\n3. LATE PAYMENT\nA late fee of 2% per month applies to unpaid amounts.\n\n4. MAINTENANCE\nThe tenant must promptly report any damage to the landlord.`}
function referencedAnswer(doc:DocumentGraph,question:string){const q=question.toLowerCase(),hits=doc.clauses.filter(c=>c.rawText.toLowerCase().split(/\W+/).some(w=>w.length>4&&q.includes(w))).slice(0,3),sources=hits.length?hits:doc.clauses.slice(0,2);if(/should i|sign|legal advice|sue/.test(q))return `Murdock cannot tell you whether to sign or take legal action. You could ask a qualified lawyer how the terms in ${sources.map(c=>c.sectionLabel).join(" and ")} apply to your circumstances. [${sources.map(c=>c.sectionLabel).join("][")}]`;return `${sources.map(c=>`${c.plainLanguageSummary} [${c.sectionLabel}]`).join(" ")} This is general information based only on the cited clauses, not legal advice.`;}

const questionSchema=z.object({question:z.string().trim().min(3).max(1000)});const compareSchema=z.object({leftDocumentId:z.string().min(1).max(100),rightText:z.string().trim().min(10).max(500_000)});
app.get("/health", (_q,r)=>r.json({name:"Murdock API",status:"ok",authRequired}));
app.post("/documents/sample", requireUser, writeLimiter, (_q,r)=>{const d=extractGraph(r.locals.userId,"Sample rental agreement",sampleText());documents.set(d.id,d);r.status(201).json(d)});
app.post("/documents", requireUser, writeLimiter, upload.single("file"), async(q,r)=>{try{if(!q.file)return r.status(400).json({error:"Choose a PDF, DOCX, or TXT file first."});const text=await fileText(q.file);if(!text.trim())return r.status(422).json({error:"The uploaded file contains no readable text."});const d=extractGraph(q.res?.locals.userId ?? "local_demo_user",q.file.originalname,text);documents.set(d.id,d);r.status(201).json(d)}catch(error){const message=error instanceof Error ? error.message : "The file could not be read.";console.error("Document upload failed",{name:q.file?.originalname,error:message});r.status(422).json({error:message.includes("Unsupported file type")||message.includes("empty")||message.includes("no readable")?message:"The file could not be parsed. Please try a valid PDF, DOCX, or TXT file."})}});
app.post("/documents/:id/ask", requireUser, writeLimiter, (q,r)=>{const parsed=questionSchema.safeParse(q.body),d=ownedDocument(String(q.params.id),r.locals.userId);if(!parsed.success)return r.status(400).json({error:"Request rejected."});if(!d)return r.status(404).json({error:"Document not found."});r.json({answer:referencedAnswer(d,parsed.data.question)})});
app.post("/compare", requireUser, writeLimiter, (q,r)=>{const parsed=compareSchema.safeParse(q.body);if(!parsed.success)return r.status(400).json({error:"Request rejected."});const left=ownedDocument(parsed.data.leftDocumentId,r.locals.userId);if(!left)return r.status(404).json({error:"Document not found."});const right=extractGraph(r.locals.userId,"Pasted comparison",parsed.data.rightText);documents.set(right.id,right);const misses=left.clauses.filter(l=>!right.clauses.some(x=>x.clauseType===l.clauseType));r.json({summary:`Compared ${left.clauses.length} source clauses with ${right.clauses.length} clauses in the pasted version. ${misses.length} original clause types have no matching clause: ${misses.map(c=>c.sectionLabel).join(", ")||"none"}. Review these cited sections with a lawyer for their practical effect. This is general information, not legal advice.`})});
app.use((_req,res)=>res.status(404).json({error:"Route not found."}));
app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{if(error instanceof multer.MulterError){if(error.code === "LIMIT_FILE_SIZE")return res.status(413).json({error:"File is too large. Please upload a file smaller than 12 MB."});if(error.code === "LIMIT_UNEXPECTED_FILE")return res.status(400).json({error:"Upload one file using the file field."});return res.status(400).json({error:"The upload could not be accepted."});}console.error("Unhandled API error",error);res.status(500).json({error:"An unexpected API error occurred."});});
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => console.info(`Murdock API listening on ${port}`));
}

export { app };
