# User Personas
## Law Office Management Web Application (LOMA)

**Version:** 1.0  
**Date:** 2026-02-23  

---

## Persona 1: Lawyer (Primary)
**Profile**
- Role: Lawyer / Attorney / Case Owner
- Environment: Office + court days; needs fast mobile-friendly web experience
- Language: English and/or Arabic

**Goals**
- Create and manage customers and cases quickly.
- Track hearings/sessions and deadlines.
- Maintain compliant document handling (confidentiality + access controls).
- Produce draft invoices (optional tenant setting).
- Close/Archive cases with complete history.

**Key Workflows**
- Customer creation with identity validation and required docs.
- Case creation (minimal) + completion guided by completeness %.
- Add participants (multiple customers/opponents), communications, notes (append-only), filings.
- Manage tasks and reminders; schedule sessions and reschedules.
- Upload documents, check-out/in, internal share with expiry.

**Pain Points**
- Scattered docs; unsure “latest version”.
- Missed dates due to lack of reminders.
- Sensitive documents accidentally shared.
- Time wasted on manual data entry.

**Permissions (MVP)**
- Case membership-based access.
- Full access to case operations within membership (except admin-only actions).
- Finance visibility: invoice headers only for permitted scope.
- Cannot finalize invoices, record payments, approve expenses by default.

---

## Persona 2: Accountant (Primary)
**Profile**
- Role: Accountant / Finance Officer
- Environment: Office, reporting-focused
- Language: English and/or Arabic

**Goals**
- Finalize invoices, track payments, control receivables.
- Approve expenses via multi-step workflow.
- Maintain wages records and exports.
- Generate reports and exports with audit trail.

**Key Workflows**
- Finalize and void invoices (with reason).
- Record payments (partial allowed; no overpayments).
- Approve expenses and export financial reports (CSV).
- Access finance attachments only when permitted.

**Pain Points**
- Missing billing inputs from lawyers.
- Lack of approval trails.
- Export processes are manual and not auditable.

**Permissions (MVP)**
- Full access to Accounting module.
- Limited access to legal content: no general case notes/filings/comms unless explicitly allowed.
- Finance attachments viewable where permitted.

---

## Persona 3: Tenant Admin (Secondary)
**Profile**
- Role: Office IT/Operations admin for a firm (tenant)
- Responsible for configuration and user management

**Goals**
- Configure master data (case types, doc types, roles, workflows).
- Manage users, roles, and case memberships.
- Enforce retention display, legal holds, and lock breaks when needed.

**Key Workflows**
- Manual user creation/deactivation.
- Configure contact roles, participant roles, filing types, comm types, relationship types.
- Configure case types and templates.
- Configure docTypes and allowed file types.
- Configure expense approval chain (role-based multi-step).
- Apply/release legal hold; break document locks; void invoices.

**Permissions (MVP)**
- Tenant-scoped administrative access.
- Full audit visibility within tenant.

---

## Persona 4: System Admin (Secondary)
**Profile**
- Role: Platform operator for all tenants

**Goals**
- Ensure platform uptime, security, backups and support.
- Onboard tenants and manage plan tiers.
- Perform incident response and security investigations.

**Permissions (MVP)**
- Platform-wide administrative access.
- Full audit visibility across tenants.
