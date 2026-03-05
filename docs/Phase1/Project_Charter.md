# Project Charter / Initiation Document
## Law Office Management Web Application (LOMA)

**Version:** 1.0  
**Date:** 2026-02-23  

---

## 1. Project Purpose
Build and deliver a secure law office management web application that supports:
- Customer/Client management
- Court case lifecycle support (cases can span years; focus on completeness and traceability)
- Secure document management integrated with external object storage
- Simple accounting (invoices, payments, expenses, wages) with separation of duties

## 2. Objectives
- Deliver Wave 1 MVP for Lawyer and Accountant core workflows with:
  - strong RBAC/ABAC
  - audit logging
  - governed document storage (scan gate + confidentiality)
  - bilingual EN/AR with RTL
- Ensure production readiness with monitoring, backups, restore testing.

## 3. Scope
- In scope: features approved and documented in BRD/PRD/SRS/FSD/TDD.
- Out of scope: integrations, OCR, migration, advanced retention lifecycle, dedicated DB, custom fields.

## 4. Stakeholders & Roles
- Sponsor (Tenant): Managing Partner
- Product Owner (Tenant): Operations Manager / Office Manager
- Primary Users: Lawyers, Accountants
- Tenant Admin: Office IT/Operations administrator
- System Admin: Platform operator
- Security: Security reviewer and penetration testing provider
- Engineering: Backend, Frontend, DevOps, QA

## 5. High-Level Deliverables
- BRD, PRD, SRS, FSD
- UX wireframes + style guide
- System architecture (TDD) with ERD, API, security and ops details
- MVP build and release plan
- Operational runbooks: backup/restore, incident response

## 6. High-Level Roadmap
- Wave 1 (MVP): core operations, DMS, simple accounting, admin configurability, EN/AR.
- Phase 2: integrations (email/calendar), OCR/full-text search, external doc sharing, configurable numbering, editable notes, retention editing.
- Wave 3/4: data migration/import, advanced lifecycle + multi-region replication, dedicated DB for enterprise.

## 7. Risks and Mitigations
- Authorization vulnerabilities → centralized policy engine + automated tests + pen testing
- Malware uploads → mandatory scan gate + quarantine + blocked download
- Configurability scope creep → restrict to master data + templates (no dynamic custom fields in MVP)
- Tenant storage misconfiguration → validation checks + least privilege credentials + secret manager

## 8. Success Metrics
- KPI alignment per BRD
- Production readiness gates met (SRS + DoD)

## 9. Approvals
- Sponsor:
- Product Owner:
- Architecture:
- Security:
- Delivery:
