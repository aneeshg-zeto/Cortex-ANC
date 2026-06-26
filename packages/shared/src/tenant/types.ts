import type { CortexRole } from '../ingestion/constants';

export type { CortexRole };

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
