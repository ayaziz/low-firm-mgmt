import type { Role } from '@/types';

export const CAPABILITIES = {
  canCreateCase: ['Lawyer', 'TenantAdmin', 'SystemAdmin'] as Role[],
  canCreateCustomer: ['Lawyer', 'TenantAdmin', 'SystemAdmin'] as Role[],
  canAccessCaseDetails: ['Lawyer', 'TenantAdmin', 'SystemAdmin'] as Role[],
  canAccessAdmin: ['TenantAdmin', 'SystemAdmin'] as Role[],
  canManageCourts: ['TenantAdmin', 'SystemAdmin'] as Role[],
  canManageHearings: ['Lawyer', 'TenantAdmin', 'SystemAdmin'] as Role[],
  canManageCalendar: ['Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin'] as Role[],
  canManageTemplates: ['Lawyer', 'TenantAdmin', 'SystemAdmin'] as Role[],
  canManageTimeEntries: ['Lawyer', 'TenantAdmin', 'SystemAdmin'] as Role[],
  canApproveTimeEntries: ['TenantAdmin', 'SystemAdmin', 'Accountant'] as Role[],
};

export function hasAnyRole(userRoles: Role[] | undefined, requiredRoles: Role[]): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  return requiredRoles.some((role) => userRoles.includes(role));
}
