import { get, post, put, del } from './client';
import type { UserInfo, MasterDataItem, CaseType, TenantSettings, PaginatedResult } from '@/types';

export const adminApi = {
  // Users
  listUsers(params?: Record<string, string>): Promise<PaginatedResult<UserInfo>> {
    return get<PaginatedResult<UserInfo>>('/admin/users', params);
  },

  createUser(data: {
    email: string;
    displayName: string;
    roles: string[];
    language?: string;
  }): Promise<UserInfo> {
    return post<UserInfo>('/admin/users', data);
  },

  updateUser(id: string, data: Partial<{
    displayName: string;
    roles: string[];
    isActive: boolean;
    language: string;
  }>): Promise<UserInfo> {
    return put<UserInfo>(`/admin/users/${id}`, data);
  },

  // Master Data
  listMasterData(category: string): Promise<MasterDataItem[]> {
    return get<MasterDataItem[]>('/admin/master-data', { category });
  },

  createMasterData(data: {
    category: string;
    code: string;
    labelEn: string;
    labelAr: string;
    sortOrder?: number;
  }): Promise<MasterDataItem> {
    return post<MasterDataItem>('/admin/master-data', data);
  },

  updateMasterData(id: string, data: Partial<{
    labelEn: string;
    labelAr: string;
    isActive: boolean;
    sortOrder: number;
  }>): Promise<MasterDataItem> {
    return put<MasterDataItem>(`/admin/master-data/${id}`, data);
  },

  deleteMasterData(id: string): Promise<void> {
    return del(`/admin/master-data/${id}`);
  },

  // Case Types
  listCaseTypes(): Promise<CaseType[]> {
    return get<CaseType[]>('/admin/case-types');
  },

  createCaseType(data: {
    code: string;
    labelEn: string;
    labelAr: string;
    taskTemplates?: unknown;
    docRequirementTemplates?: unknown;
  }): Promise<CaseType> {
    return post<CaseType>('/admin/case-types', data);
  },

  updateCaseType(id: string, data: Partial<CaseType>): Promise<CaseType> {
    return put<CaseType>(`/admin/case-types/${id}`, data);
  },

  deleteCaseType(id: string): Promise<void> {
    return del(`/admin/case-types/${id}`);
  },

  // Expense Workflow
  getExpenseWorkflow(): Promise<{ steps: Array<{ stepOrder: number; approverRole: string }> }> {
    return get('/admin/expense-workflow');
  },

  saveExpenseWorkflow(steps: Array<{ stepOrder: number; approverRole: string }>): Promise<void> {
    return post('/admin/expense-workflow', { steps });
  },

  // Tenant Settings
  getTenantSettings(): Promise<TenantSettings> {
    return get<TenantSettings>('/admin/tenant-settings');
  },

  updateTenantSettings(data: Partial<TenantSettings>): Promise<TenantSettings> {
    return put<TenantSettings>('/admin/tenant-settings', data);
  },
};
