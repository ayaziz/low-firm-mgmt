# Phase 3 Rich Document Upload and System-wide Integration Spec

## 1. Goal
Deliver a unified, rich upload capability that is available in every major workflow so users can attach, classify, and govern documents without leaving the screen they are working on.

## 2. Integration Matrix

| Module | Entry Point | Default Metadata | Mandatory Rules |
|---|---|---|---|
| Customer | KYC panel + Documents tab | `scope=customer`, kyc doc type | KYC doc type + identity fields required |
| Case | Documents tab + timeline quick action | `scope=case`, case tags | Case reference required |
| Session/Hearing | Detail form attachment section | hearing/session doc type | Session ID + role-restricted confidentiality |
| Filing | Filing form evidence section | filing/evidence doc type | Filing reference mandatory |
| Expense | Attachment block in form | finance tag + retention default | Allowed MIME list for receipts/invoices |
| Invoice | Attachment block in form | invoice-support doc type | Amount proof attachment optional/tenant policy |
| Task | Drawer attachment slot | task artifact tag | None by default |
| Communication | Drawer attachment slot | communication evidence tag | None by default |

## 3. UX Requirements
- Drag-drop zone + click-to-browse + paste image support.
- Multi-file queue with per-file progress and status badges.
- Pre-upload metadata editor with inline validation.
- Post-upload bulk metadata edit for selected successful files.
- Non-blocking failures: one failed file does not cancel successful files.

## 4. API Contract
1. Create upload session (context-aware validation + signed URLs).
2. Upload directly to object store per file.
3. Finalize upload session to persist document rows, versions, tags, and origin links.
4. Emit activity + status/timeline events.

## 5. Security and Governance
- Origin metadata immutable after finalize (except by admin correction API).
- Confidentiality defaults inherited from module context and case/customer policy.
- Upload actions audited with actor, module origin, and policy decisions.
- Antivirus/scan and OCR remain asynchronous with visible status.

## 6. Acceptance Scenarios
- User uploads 10 files from Case screen, edits tags in bulk, and sees all documents in case feed + library.
- User uploads receipt in Expense form and approver can open attachment from approval screen.
- KYC upload blocks finalize until required identity doc metadata is provided.
- Retry of one failed file succeeds without re-uploading completed files.
