# Deliverables

Submission artifacts for the PEAAII 2026 Agentic AI Applications Hackathon.

| File | Purpose |
|------|---------|
| `HistorAI_Deliverable.docx` | **Deliverable 1 & 2** — project overview, agentic AI design, working prototype, demo, evaluation, and project documentation. |
| `build-docx.mjs` | Generates the document from source so it can be regenerated after edits. |
| *(reserved)* | Demo video (to be recorded and stored here). |

## Rebuild the document

The builder uses the [`docx`](https://www.npmjs.com/package/docx) npm package, which is
not part of the app's dependencies:

```bash
npm install --no-save docx
node deliverables/build-docx.mjs
```

This overwrites `HistorAI_Deliverable.docx`.

## Screenshots

The Demo section contains five clearly marked **placeholder boxes** (S1–S5) with the
intended content described in each box. To finish the document:

1. Run the app (`npm run dev`) and capture each screen.
2. In Word, click the dashed placeholder box and insert the image (Insert → Pictures),
   or delete the box and insert the image with the given caption.
3. Keep the caption lines that follow each placeholder.

The five placeholders are:

- **S1** — role choice and the youth question
- **S2** — the River answering by voice or AI interview
- **S3** — the review screen with the Safety check and Editor review badges
- **S4** — the published story in the youth feed
- **S5** — a scam attempt blocked before delivery

The workflow diagram in §2.1 is drawn with native Word tables and paragraphs, so it
stays editable and needs no image file.
