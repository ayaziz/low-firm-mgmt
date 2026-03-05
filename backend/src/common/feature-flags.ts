/**
 * Phase 3 Feature Flags
 *
 * Centralised flags for safe rollout of Phase 3 capabilities.
 * Each flag defaults to environment variable → true.
 * In production, operators can disable any subsystem without a code deploy.
 */

export const FeatureFlags = {
  /** Generic approval engine (wages, invoices, postponements) */
  approvalEngine: () => process.env.FF_APPROVAL_ENGINE !== 'false',

  /** Status history / timeline projection */
  statusTimeline: () => process.env.FF_STATUS_TIMELINE !== 'false',

  /** Notification dispatch (SSE + email + scheduled) */
  notificationsDispatch: () => process.env.FF_NOTIFICATIONS_DISPATCH !== 'false',

  /** Rich upload integration (context-aware upload sessions) */
  richUpload: () => process.env.FF_RICH_UPLOAD !== 'false',

  /** OCR processing pipeline */
  ocrProcessing: () => process.env.FF_OCR_PROCESSING !== 'false',

  /** External document share links */
  externalSharing: () => process.env.FF_EXTERNAL_SHARING !== 'false',

  /** Dashboard KPI caching */
  dashboardKpis: () => process.env.FF_DASHBOARD_KPIS !== 'false',

  /** Invoice review step */
  invoiceApprovalRequired: () => process.env.INVOICE_APPROVAL_REQUIRED === 'true',
} as const;
