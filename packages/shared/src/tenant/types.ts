export type CortexRole = 'super_admin' | 'ceo' | 'client' | 'hr' | 'employee' | 'member';

export type TenantContext = {
  tenantId: string;
  userId: string;
  email: string;
  name: string;
  role: CortexRole;
  projectIds: string[];
  isPlatformAdmin: boolean;
  correlationId?: string;
};
