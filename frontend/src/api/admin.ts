import { get, post, patch } from './client';
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
    return patch<UserInfo>(`/admin/users/${id}`, data);
  },

  // Master Data
  listMasterData(category: string): Promise<MasterDataItem[]> {
    return get<MasterDataItem[]>(`/admin/master-data/${category}`);
  },

  createMasterData(data: {
    category: string;
    code: string;
    labelEn: string;
    labelAr: string;
    sortOrder?: number;
  }): Promise<MasterDataItem> {
    return post<MasterDataItem>(`/admin/master-data/${data.category}`, data);
  },

  updateMasterData(category: string, id: string, data: Partial<{
    labelEn: string;
    labelAr: string;
    isActive: boolean;
    sortOrder: number;
  }>): Promise<MasterDataItem> {
    return patch<MasterDataItem>(`/admin/master-data/${category}/${id}`, data);
  },

  deleteMasterData(category: string, id: string): Promise<MasterDataItem> {
    return patch<MasterDataItem>(`/admin/master-data/${category}/${id}`, { isActive: false });
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
    return patch<CaseType>(`/admin/case-types/${id}`, data);
  },

  deleteCaseType(id: string): Promise<CaseType> {
    return patch<CaseType>(`/admin/case-types/${id}`, { isActive: false });
  },

  // Expense Workflow
  getExpenseWorkflow(): Promise<{ steps: Array<{ stepOrder: number; approverRole: string }> }> {
    return get('/admin/expense-approval-workflow');
  },

  saveExpenseWorkflow(data: { name?: string; steps: Array<{ stepOrder: number; approverRole: string }> }): Promise<void> {
    return post('/admin/expense-approval-workflow', data);
  },

  // Tenant Settings
  getTenantSettings(): Promise<TenantSettings> {
    return get<TenantSettings>('/admin/settings');
  },

  updateTenantSettings(data: Partial<TenantSettings>): Promise<TenantSettings> {
    const payload: Partial<TenantSettings> = {
      currency: data.currency,
      timezone: data.timezone,
      locale: data.locale,
      planTier: data.planTier,
      lawyerCanDraft: data.lawyerCanDraft,
    };
    return patch<TenantSettings>('/admin/settings', payload);
  },
};
