export type CortexRole = 'admin' | 'ceo' | 'client' | 'hr' | 'employee';

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
