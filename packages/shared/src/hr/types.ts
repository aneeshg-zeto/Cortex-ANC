export type HrEmployee = {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
  designation: string;
  joinDate: string | null;
  status: 'active' | 'inactive' | 'on_leave';
  salaryMonthly: number;
  currency: string;
  emergencyContact: Record<string, string>;
};

export type HrPayrollRun = {
  id: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  status: 'draft' | 'processing' | 'completed';
  totalGross: number;
  totalNet: number;
  employeeCount: number;
  processedAt: string | null;
};

export type HrPayslipDeduction = { label: string; amount: number };

export type HrPayslip = {
  id: string;
  employeeId: string;
  employeeName?: string;
  payrollRunId: string | null;
  periodLabel: string;
  grossPay: number;
  deductions: HrPayslipDeduction[];
  netPay: number;
  status: 'draft' | 'issued';
  issuedAt: string | null;
};

export type HrLeaveRequest = {
  id: string;
  employeeId: string;
  employeeName?: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt: string | null;
};

export type HrEmergencyNotice = {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  targetScope: string;
  publishedBy: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type HrPluginConnection = {
  id: string;
  pluginId: string;
  status: 'connected' | 'disconnected' | 'error';
  connectedAt: string | null;
};

export type HrDashboardStats = {
  employeeCount: number;
  activeEmployees: number;
  pendingLeave: number;
  openPayrollRuns: number;
  activeNotices: number;
  connectedPlugins: number;
};
