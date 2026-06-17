export type HandleClientReplyInput = {
  approvalId: string;
  emailContent: string;
  draft: string;
};

export type ApprovalDecision = {
  approved: boolean;
};

export type IngestInitialDataInput = {
  tenantId: string;
  providers: string[];
};

export type IngestProviderInput = {
  tenantId: string;
  provider: string;
  since?: string;
};

export type IngestActivityInput = {
  tenantId: string;
  since?: string;
};
