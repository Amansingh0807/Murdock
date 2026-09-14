# Murdock — AI for Legal Assistance & Access

> A prompt-engineered GenAI assistant that makes legal documents easier to understand, compare, and act on — submitted for **Prompt Wars**.

## Problem Statement

Legal information is often complex, jargon-heavy, and hard to navigate without professional help. This project addresses the **"AI for Legal Assistance & Access"** theme by building a GenAI-powered solution that helps users understand, compare, and navigate legal documents — without replacing professional legal advice.

## Our Approach

Instead of building a generic legal chatbot, we engineered a **single structured system prompt** that turns any frontier LLM into a purpose-built legal literacy assistant — no training, no custom infrastructure, no fine‑tuning. The entire solution is delivered through prompt engineering alone, making it instantly portable to any GenAI platform.

The prompt enforces a strict internal reasoning discipline: identify the exact clause → classify it → explain it in plain language — never the other way around. This keeps every output grounded and citable instead of a vague summary.

## Features (Modes)

| Mode | What it does |
|---|---|
| **SIMPLIFY** | Rewrites a legal document section‑by‑section in plain, everyday language with inline jargon explanations |
| **RISK_SCAN** | Flags clauses as Obligation / Right / Risk / Penalty / Termination / Ambiguous, scores severity, and gives an overall document risk snapshot |
| **COMPARE** | Aligns two documents clause‑by‑clause, shows what changed and which version is more favorable |
| **ASK** | Answers user questions strictly grounded in the uploaded document(s), with every claim cited to a specific clause |
| **NEXT_STEPS / CHECKLIST** | Generates a ready‑to‑use list of questions to ask a lawyer and practical next steps, derived from flagged risks |

## Why This Approach

- **No hallucination‑by‑default**: every factual claim must cite a clause — if the model can't point to one, it says so instead of guessing.
- **No legal‑verdict trap**: the prompt hard‑blocks "should I sign this" style answers and reframes them as informational context instead — directly addressing the problem statement's requirement to *assist, not replace* professional advice.
- **Zero infra, zero training**: works on any LLM platform (Claude, GPT, Gemini) with a large context window — nothing to deploy, host, or fine‑tune.
- **Judged on real output, not promises**: because it's pure prompting, the quality is fully visible and testable live during demo.

## How to Use

1. Open the file `legal-assist-prompt-wars.md` and copy the prompt block.
2. Paste it as the **system prompt / custom instructions** on your chosen LLM platform (ChatGPT custom GPT, Claude Project, Gemini Gem, etc.).
3. Start a new chat. The assistant will ask you to paste or upload a legal document.
4. Paste a document (or two, labeled Document A / Document B, for comparison) and ask for any mode — or just say "simplify this."

### Demo Script (recommended)

1. Paste a rental agreement → run **SIMPLIFY**, then **RISK_SCAN** — show the flagged clauses and severity table.
2. Paste a second, slightly different rental agreement as Document B → run **COMPARE** — show the side‑by‑side diff and "bottom line."
3. Ask a direct question ("What happens if I leave before the lease ends?") → show the cited, grounded **ASK** response.
4. Run **NEXT_STEPS** → show the auto‑generated lawyer checklist.

## Tech Stack

| Layer | What's used |
|---|---|
| Core engine | Claude / GPT‑4 / Gemini (any frontier LLM with a large context window) |
| Interface | Native chat UI of the chosen platform |
| Prompt delivery | System prompt / custom instructions (see `legal-assist-prompt-wars.md`) |
| Grounding | In‑context document text — long context window acts as the retrieval layer |
| Reasoning | Chain‑of‑thought scaffolding built into the prompt (no external tools or fine‑tuning) |

## Disclaimer

This tool provides **general legal information, not legal advice**. It does not replace consultation with a licensed legal professional. All outputs are clearly labeled as informational.

## Files in This Submission

- `README.md` — this file
- `legal-assist-prompt-wars.md` — the full system prompt + usage notes + tech stack breakdown
