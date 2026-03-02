# Document Management v2 Specification
## Law Office Management Application (LOMA) — Phase 2

**Date:** 2026-02-25  
**Baseline:** Phase 1 Document Module (FSD §3, SRS FR-DOC, TDD §5–§6)  
**Drivers:** D5 — Inadequate Document Management; D1 — Weak Data Model  
**Depends on:** PHASE2_DOMAIN_MODEL_AND_WORKFLOWS.md (Folder, DocumentTemplate entities)

---

## 1. Executive Summary

Phase 1 delivered flat-list document storage with pre-signed URLs, basic malware scanning, check-out/in, confidentiality levels, and legal hold. Phase 2 upgrades to a **hierarchical folder system**, **OCR-based full-text search**, **template-driven document generation**, **external sharing**, and a **multi-file upload** experience. The storage abstraction layer is retained to support both S3/MinIO (local/dev) and Azure Blob (production) backends.

---

## 2. Feature Inventory

| # | Feature | Source | Priority |
|---|---|---|---|
| F-DOC-01 | Hierarchical folder/library structure | D5, PRD §4.2 | P0 |
| F-DOC-02 | Folder-inherited permissions & confidentiality | D5, GAPS ❌ | P0 |
| F-DOC-03 | Multi-file drag-and-drop upload | D5, UX feedback | P0 |
| F-DOC-04 | Document templates (contract/letter/filing) | PRD §4.2 | P1 |
| F-DOC-05 | Template variable substitution (Handlebars) | PRD §4.2 | P1 |
| F-DOC-06 | OCR text extraction pipeline | PRD §4.2 "OCR" | P1 |
| F-DOC-07 | Full-text document search | D5, SRS FR-SEARCH | P1 |
| F-DOC-08 | External sharing (time-limited link) | PRD §4.2 | P2 |
| F-DOC-09 | Azure Blob storage provider | SRS FR-STO, TDD §5 | P1 |
| F-DOC-10 | Configurable document numbering scheme | PRD §4.2 | P2 |
| F-DOC-11 | Document version diff (metadata) | UX feedback | P2 |
| F-DOC-12 | Bulk operations (move, tag, delete) | UX feedback | P2 |

---

## 3. Folder / Library System

### 3.1 Data Model

See `PHASE2_DOMAIN_MODEL_AND_WORKFLOWS.md §2` for full Folder entity.

**Key Fields:**
- `parent_folder_id` — nullable (null = root)
- `path` — materialized path (e.g., `/clients/acme/contracts`), max depth 10
- `scope` — enum: `Customer | Case | Tenant`
- `scope_id` — FK to customer or case
- `confidentiality_default` — inherited by new child documents unless overridden
- `inherit_permissions` — if true, child documents inherit folder ACL

### 3.2 Default Folder Templates

On case creation, the system auto-creates a standard folder hierarchy based on CaseType configuration:

```
📁 {CaseNumber}/
├── 📁 Court Filings/
├── 📁 Contracts/
├── 📁 Correspondence/
├── 📁 Evidence/
├── 📁 Internal Memos/    (confidentiality_default: Confidential)
└── 📁 Financial/          (confidentiality_default: Confidential)
```

TenantAdmin can customize the template per CaseType.

### 3.3 Operations

| Operation | Endpoint | Method | Auth |
|---|---|---|---|
| List root folders | `/api/v2/folders?scope={scope}&scopeId={id}` | GET | Case member or customer viewer |
| List folder children | `/api/v2/folders/{id}/children` | GET | Folder ACL |
| Get folder tree | `/api/v2/folders/{id}/tree` | GET | Folder ACL |
| Create folder | `/api/v2/folders` | POST | Lawyer (scope), TenantAdmin |
| Rename folder | `/api/v2/folders/{id}` | PATCH | Folder creator or TenantAdmin |
| Move folder | `/api/v2/folders/{id}/move` | POST | TenantAdmin |
| Archive folder | `/api/v2/folders/{id}/archive` | POST | TenantAdmin |
| Delete folder (empty) | `/api/v2/folders/{id}` | DELETE | TenantAdmin |

### 3.4 Permission Inheritance Logic

```
function resolveDocumentPermissions(document, folder):
  if folder.inherit_permissions:
    acl = folder.acl ∪ document.explicit_acl
  else:
    acl = document.explicit_acl (default: case members)
  
  if document.confidentiality >= folder.confidentiality_default:
    apply document.confidentiality
  else:
    apply folder.confidentiality_default
  
  return acl
```

---

## 4. Document Templates

### 4.1 Template Management

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v2/document-templates` | GET | Lawyer, TenantAdmin | List templates |
| `/api/v2/document-templates` | POST | TenantAdmin | Create template |
| `/api/v2/document-templates/{id}` | GET | Lawyer, TenantAdmin | Get template detail |
| `/api/v2/document-templates/{id}` | PUT | TenantAdmin | Update template |
| `/api/v2/document-templates/{id}` | DELETE | TenantAdmin | Soft-delete template |
| `/api/v2/document-templates/{id}/preview` | POST | Lawyer, TenantAdmin | Preview with sample data |
| `/api/v2/document-templates/{id}/generate` | POST | Lawyer | Generate document into folder |

### 4.2 Template Engine

- **Format:** Handlebars (`.hbs`) for text-based templates
- **Output:** PDF (via Puppeteer/wkhtmltopdf) or DOCX (via docxtemplater)
- **Variables:** Defined by `variable_schema` (JSON Schema) on the template
- **Auto-fill context:** System provides `{{case.*}}`, `{{customer.*}}`, `{{court.*}}`, `{{judge.*}}`, `{{tenant.*}}`, `{{today}}`, `{{user.*}}`
- **Custom variables:** User fills remaining via form built from `variable_schema`

### 4.3 Generation Workflow

1. Lawyer selects template + target folder
2. UI renders form from `variable_schema`; auto-fill known fields from case/customer context
3. Lawyer fills remaining fields → POST `/generate`
4. Backend merges template + variables → produces PDF/DOCX
5. File uploaded to storage via standard document upload flow
6. Document record created with `source: "template"`, `template_id`, `version_id`
7. Generated document appears in target folder

---

## 5. OCR & Full-Text Search

### 5.1 OCR Pipeline

```
                            ┌──────────────┐
  Upload → Malware Scan ──→ │ OCRWorker    │ ──→ full_text_content → Search Index
   (BullMQ)                 │ (Tesseract)  │
                            └──────────────┘
```

**Processing Rules:**
- Triggered automatically for: PDF (image-based), PNG, JPG, TIFF
- Skipped for: DOCX, XLSX, text files (pre-extracted), already-OCR'd PDFs
- Uses Tesseract with `ara` + `eng` language packs (matching i18n support)
- OCR status tracked on Document: `Pending | Processing | Completed | Failed | Skipped`
- Failed OCR does not block document availability
- Max file size for OCR: 50 MB
- BullMQ queue: `ocr-extraction` with 3 retries, 60s backoff

### 5.2 Full-Text Search

**Implementation:** PostgreSQL `tsvector` + GIN index on `document.full_text_content`

```sql
ALTER TABLE document ADD COLUMN full_text_tsvector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(full_text_content, ''))) STORED;
CREATE INDEX idx_doc_fulltext ON document USING GIN (full_text_tsvector);
```

**Search Endpoint:**

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v2/documents/search` | GET | Case member, scope enforced | Full-text + metadata search |

**Query Parameters:**
- `q` — full-text search string (ts_query)
- `folderId` — restrict to folder and descendants
- `caseId` — restrict to case
- `customerId` — restrict to customer
- `mimeType` — filter by type
- `confidentiality` — max confidentiality level
- `dateFrom` / `dateTo` — upload date range

**Response includes:** `headline` (ts_headline snippet), `rank` (ts_rank score).

---

## 6. Multi-File Upload

### 6.1 Behavior

- Drag-and-drop zone accepts multiple files (max 10 per batch)
- Each file gets its own progress bar and status indicator
- Files uploaded in parallel (max 3 concurrent) using pre-signed URLs
- If any file fails malware scan, only that file is rejected; others proceed
- Folder ID is pre-selected from current folder context

### 6.2 File Validation

| Rule | Value | Enforcement |
|---|---|---|
| Max file size | 50 MB | Frontend + backend |
| Allowed types | PDF, DOCX, XLSX, PNG, JPG, TIFF, TXT, CSV | Backend MIME + extension |
| Filename sanitization | Strip path traversal, Unicode normalize | Backend |
| Virus scan | ClamAV via BullMQ worker | Backend (async) |
| Duplicate detection | SHA-256 checksum match within folder | Backend (warn, don't block) |

---

## 7. External Sharing

### 7.1 Share Link Model

```sql
CREATE TABLE document_share (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES document(id),
  version_id UUID REFERENCES document_version(id),
  token VARCHAR(128) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  max_downloads INT DEFAULT 5,
  download_count INT DEFAULT 0,
  password_hash VARCHAR(256), -- optional
  created_by UUID REFERENCES "user"(id),
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);
```

### 7.2 Rules

- Only Lawyer or TenantAdmin can create share links
- Default expiry: 7 days (configurable 1–30 days)
- Highly Confidential documents cannot be shared externally
- Legal-hold documents cannot be shared externally
- Download counter enforced; link deactivated when `max_downloads` reached
- Optional password protection (bcrypt-hashed)
- All share creation and access logged as audit events
- Revocation is immediate and irrevocable

### 7.3 Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v2/documents/{id}/share` | POST | Lawyer, TenantAdmin | Create share link |
| `/api/v2/documents/{id}/shares` | GET | Document viewer | List active shares |
| `/api/v2/shares/{token}` | GET | Public (+ optional password) | Download shared document |
| `/api/v2/shares/{token}/revoke` | POST | Share creator, TenantAdmin | Revoke share link |

---

## 8. Storage Provider Abstraction (Extended)

### 8.1 Provider Interface (Additions)

```typescript
interface StorageProvider {
  // Phase 1 (existing)
  createUploadUrl(path: string, contentType: string, ttl: number): Promise<string>;
  createDownloadUrl(path: string, ttl: number): Promise<string>;
  deleteObject(path: string): Promise<void>;

  // Phase 2 (new)
  copyObject(sourcePath: string, destPath: string): Promise<void>;
  moveObject(sourcePath: string, destPath: string): Promise<void>;
  listObjects(prefix: string): Promise<StorageObject[]>;
  getObjectMetadata(path: string): Promise<ObjectMetadata>;
}
```

### 8.2 Hierarchical Path Strategy

Phase 1 used flat paths: `{tenantId}/{documentId}/{versionId}`

Phase 2 uses folder-aligned paths: `{tenantId}/{scope}/{scopeId}/{folderPath}/{documentId}/{versionId}`

**Migration:** Existing documents retain flat paths. New documents use hierarchical paths. StorageProvider resolves path format by checking document's `folder_id`.

### 8.3 Azure Blob Provider

```typescript
class AzureBlobStorageProvider implements StorageProvider {
  // Uses @azure/storage-blob SDK
  // Container per tenant: {tenantSlug}-documents
  // SAS token generation for upload/download URLs
  // Blob metadata tags for indexing
  // Lifecycle management policy for archive tier
}
```

**Config per Tenant:**
```json
{
  "provider": "azure-blob",
  "connectionString": "env:AZURE_STORAGE_CONNECTION",
  "containerPrefix": "loma-",
  "defaultAccessTier": "Hot",
  "archiveTierAfterDays": 365
}
```

---

## 9. Configurable Document Numbering

### 9.1 Scheme Definition

TenantAdmin configures numbering pattern per document category:

| Token | Description | Example |
|---|---|---|
| `{YEAR}` | 4-digit year | 2026 |
| `{MONTH}` | 2-digit month | 03 |
| `{SEQ}` | Auto-increment within scope | 001 |
| `{CASE}` | Case number | C-2026-001 |
| `{CAT}` | Category abbreviation | CTR |
| `{TENANT}` | Tenant abbreviation | LAW |

**Default pattern:** `{TENANT}-DOC-{YEAR}-{SEQ}` → `LAW-DOC-2026-001`

### 9.2 Sequence Table

```sql
CREATE TABLE document_sequence (
  tenant_id UUID REFERENCES tenant(id),
  scope VARCHAR(50) DEFAULT 'global', -- or category
  year INT,
  current_value INT DEFAULT 0,
  PRIMARY KEY (tenant_id, scope, year)
);
```

Sequence increment uses `SELECT ... FOR UPDATE` to avoid race conditions.

---

## 10. Non-Functional Requirements

| Requirement | Target | Notes |
|---|---|---|
| Upload throughput | ≥ 10 concurrent uploads per tenant | Pre-signed URL direct upload |
| OCR latency | < 30s for standard PDF (≤ 10 pages) | BullMQ worker pool |
| Full-text search latency | < 500ms for 95th percentile | GIN index + tenant scope |
| Share link access latency | < 200ms | CDN-friendly signed URL redirect |
| Folder tree depth | Max 10 levels | Enforced on create/move |
| Folder count per scope | Max 500 per case/customer | Soft limit, configurable |
| Storage quota | 10 GB per tenant (default) | Admin-configurable |
