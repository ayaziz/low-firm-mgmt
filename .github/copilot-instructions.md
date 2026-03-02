# Law Firm App – Copilot Engineering Instructions

These rules apply to ALL code generation, refactoring, fixes, and documentation tasks in this repository.

---

# 1. Plan Before Code (Mandatory for Non-Trivial Tasks)

For any change involving:
- Authorization / roles
- API contracts
- Database schema
- Case lifecycle logic
- Document storage structure
- Accounting calculations

Copilot MUST:

1. Outline a short plan in comments before implementation.
2. Define expected inputs / outputs.
3. Identify affected modules.
4. Consider backward compatibility.

Never jump straight to implementation for architectural changes.

---

# 2. Role & Security First (Critical for This Project)

This is a multi-persona system:

- Lawyer
- Accountant
- Admin (if applicable)

Every feature MUST:

- Explicitly define required role(s)
- Enforce authorization at API layer
- Avoid UI-only role restrictions
- Prevent privilege escalation
- Return correct HTTP codes:
  - 401 → unauthenticated
  - 403 → unauthorized
  - 404 → resource not found
  - 400 → validation error

Never expose financial endpoints to Lawyer role.
Never expose case modification to Accountant role.

---

# 3. API Discipline

All APIs must:

- Follow REST conventions
- Use consistent route prefix `/api/v1/`
- Return structured JSON:
  {
    success: boolean,
    data: any,
    error?: string
  }

Validation:
- Validate DTOs explicitly
- Never trust client input
- Return 400 with clear validation messages

---

# 4. Database Safety Rules

- No destructive schema changes without migration
- All migrations must be reversible
- Use transactions for:
  - Case status transitions
  - Payment creation
  - Invoice generation

Never mix financial updates with document operations in the same transaction.

---

# 5. Document Management Rules

Documents are stored hierarchically:

/clients/{clientId}/cases/{caseId}/...

Rules:
- Validate ownership before file access
- Enforce access control before generating SAS/URLs
- Never expose raw blob paths to frontend

---

# 6. Accounting Integrity

Financial operations must be:

- Idempotent
- Logged
- Auditable
- Linked to a case or client

Never delete financial records.
Use soft-delete if required.

---

# 7. Error Handling Standards

Common errors to detect and fix:

- 401 from misconfigured middleware
- 403 from missing role mapping
- 404 from missing route registration
- 400 from validation schema mismatch

All controllers must:

- Catch errors
- Log structured error
- Return proper HTTP status

Never swallow errors silently.

---

# 8. Testing Requirements (Non-Optional)

For every API:

- Add integration test
- Validate role behavior
- Validate validation errors
- Validate happy path

For UI:

- Verify role-based rendering
- Verify forbidden buttons not visible

Do not mark feature complete without tests passing.

---

# 9. Logging & Observability

Every:

- Authentication attempt
- Case status change
- Payment operation
- Document upload

Must produce structured logs.

No console.log in production code.

---

# 10. Code Quality Principles

- Simplicity first
- Minimal changes
- No duplicated logic
- Extract reusable services
- Clear naming over clever naming

Ask internally:
“Would a senior backend engineer approve this?”

---

# 11. Bug Fixing Protocol

When fixing a bug:

1. Identify root cause.
2. Check related modules for same pattern.
3. Add test that would have caught it.
4. Implement minimal fix.
5. Confirm no regression.

Never patch blindly.

---

# 12. End-to-End Safety Before Completion

Before considering any change complete:

- Run tests
- Confirm correct HTTP codes
- Confirm no unauthorized access
- Confirm no unhandled promise rejections
- Confirm logs show expected behavior