export const HR_DEFAULT_DEPARTMENTS = [
  'Engineering',
  'HR',
  'Sales',
  'Marketing',
  'Finance',
  'Operations',
] as const;

export type HrUploadRow = {
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  designation: string;
  date_of_joining: string;
  salary: string;
  bank_account_number: string;
  bank_ifsc: string;
  status: string;
};

export type HrUploadFieldError = { field: keyof HrUploadRow; message: string };

export type HrUploadRowValidation = {
  rowIndex: number;
  row: HrUploadRow;
  errors: HrUploadFieldError[];
};

export type HrUploadCachePayload = {
  tenantId: string;
  userId: string;
  source: 'file' | 'google-sheets';
  sourceName?: string;
  rows: HrUploadRow[];
  createdAt: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '_');
}

const HEADER_ALIASES: Record<string, keyof HrUploadRow> = {
  first_name: 'first_name',
  firstname: 'first_name',
  fname: 'first_name',
  last_name: 'last_name',
  lastname: 'last_name',
  lname: 'last_name',
  email: 'email',
  email_address: 'email',
  department: 'department',
  dept: 'department',
  designation: 'designation',
  title: 'designation',
  job_title: 'designation',
  date_of_joining: 'date_of_joining',
  join_date: 'date_of_joining',
  joining_date: 'date_of_joining',
  doj: 'date_of_joining',
  salary: 'salary',
  monthly_salary: 'salary',
  salary_monthly: 'salary',
  bank_account_number: 'bank_account_number',
  bank_account: 'bank_account_number',
  account_number: 'bank_account_number',
  bank_ifsc: 'bank_ifsc',
  ifsc: 'bank_ifsc',
  ifsc_code: 'bank_ifsc',
  status: 'status',
};

export function emptyUploadRow(): HrUploadRow {
  return {
    first_name: '',
    last_name: '',
    email: '',
    department: '',
    designation: '',
    date_of_joining: '',
    salary: '',
    bank_account_number: '',
    bank_ifsc: '',
    status: 'active',
  };
}

function coerceCellValue(field: keyof HrUploadRow, raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (field === 'date_of_joining' && raw instanceof Date) {
    return raw.toISOString().slice(0, 10);
  }
  if (field === 'date_of_joining' && typeof raw === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + raw);
    return epoch.toISOString().slice(0, 10);
  }
  return String(raw).trim();
}

export function mapRawRowsToUploadRows(headers: string[], rawRows: unknown[][]): HrUploadRow[] {
  const fieldIndexes: Partial<Record<keyof HrUploadRow, number>> = {};
  headers.forEach((h, i) => {
    const key = HEADER_ALIASES[normHeader(h)];
    if (key) fieldIndexes[key] = i;
  });

  const rows: HrUploadRow[] = [];
  for (const raw of rawRows) {
    if (!raw || !raw.some((c) => String(c ?? '').trim())) continue;
    const row = emptyUploadRow();
    for (const [field, idx] of Object.entries(fieldIndexes) as [keyof HrUploadRow, number][]) {
      row[field] = coerceCellValue(field, raw[idx]);
    }
    if (!row.status) row.status = 'active';
    rows.push(row);
  }
  return rows;
}

function parseSalary(value: string): number | null {
  const n = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function normalizeDate(value: string): string | null {
  if (!value) return null;
  if (ISO_DATE_RE.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function validateUploadRow(
  row: HrUploadRow,
  options: {
    rowIndex: number;
    departments?: readonly string[];
    existingEmails?: Set<string>;
    fileEmails?: Map<string, number>;
  },
): HrUploadFieldError[] {
  const errors: HrUploadFieldError[] = [];
  const departments = options.departments ?? HR_DEFAULT_DEPARTMENTS;
  const email = row.email.trim().toLowerCase();

  if (!row.first_name.trim() || row.first_name.trim().length > 50) {
    errors.push({ field: 'first_name', message: 'First name is required (1-50 characters)' });
  }
  if (!row.last_name.trim() || row.last_name.trim().length > 50) {
    errors.push({ field: 'last_name', message: 'Last name is required (1-50 characters)' });
  }
  if (!email || !EMAIL_RE.test(email)) {
    errors.push({ field: 'email', message: 'Valid email is required' });
  } else {
    if (options.existingEmails?.has(email)) {
      errors.push({ field: 'email', message: 'Email already exists in workspace' });
    }
    const dupIdx = options.fileEmails?.get(email);
    if (dupIdx !== undefined && dupIdx !== options.rowIndex) {
      errors.push({ field: 'email', message: 'Duplicate email in upload file' });
    }
  }
  if (!row.department.trim() || !departments.includes(row.department.trim())) {
    errors.push({
      field: 'department',
      message: `Department must be one of: ${departments.join(', ')}`,
    });
  }
  if (!row.designation.trim() || row.designation.trim().length > 100) {
    errors.push({ field: 'designation', message: 'Designation is required (1-100 characters)' });
  }

  const joinDate = normalizeDate(row.date_of_joining.trim());
  if (!joinDate) {
    errors.push({ field: 'date_of_joining', message: 'Valid join date required (YYYY-MM-DD)' });
  } else {
    const today = new Date().toISOString().slice(0, 10);
    if (joinDate > today) {
      errors.push({ field: 'date_of_joining', message: 'Join date cannot be in the future' });
    }
  }

  const salary = parseSalary(row.salary);
  if (salary === null || salary <= 0) {
    errors.push({ field: 'salary', message: 'Salary must be a positive number' });
  }

  const acct = row.bank_account_number.trim();
  if (acct && !/^\d{9,18}$/.test(acct)) {
    errors.push({ field: 'bank_account_number', message: 'Account number must be 9-18 digits' });
  }

  const ifsc = row.bank_ifsc.trim();
  if (ifsc && !IFSC_RE.test(ifsc)) {
    errors.push({ field: 'bank_ifsc', message: 'IFSC must be 4 letters + 7 digits' });
  }

  const status = row.status.trim().toLowerCase() || 'active';
  if (status !== 'active' && status !== 'inactive') {
    errors.push({ field: 'status', message: "Status must be 'active' or 'inactive'" });
  }

  return errors;
}

export function validateUploadRows(
  rows: HrUploadRow[],
  existingEmails: string[],
): HrUploadRowValidation[] {
  const existing = new Set(existingEmails.map((e) => e.toLowerCase()));
  const fileEmails = new Map<string, number>();
  rows.forEach((row, i) => {
    const email = row.email.trim().toLowerCase();
    if (email) fileEmails.set(email, i);
  });

  return rows.map((row, rowIndex) => ({
    rowIndex,
    row,
    errors: validateUploadRow(row, { rowIndex, existingEmails: existing, fileEmails }),
  }));
}

export function uploadRowToEmployeeInput(row: HrUploadRow) {
  const joinDate = normalizeDate(row.date_of_joining.trim()) ?? row.date_of_joining;
  const salary = parseSalary(row.salary) ?? 0;
  const status = (row.status.trim().toLowerCase() || 'active') as 'active' | 'inactive';
  const metadata: Record<string, string> = {};
  if (row.bank_account_number.trim()) metadata.bank_account_number = row.bank_account_number.trim();
  if (row.bank_ifsc.trim()) metadata.bank_ifsc = row.bank_ifsc.trim().toUpperCase();

  return {
    fullName: `${row.first_name.trim()} ${row.last_name.trim()}`.trim(),
    email: row.email.trim().toLowerCase(),
    department: row.department.trim(),
    designation: row.designation.trim(),
    joinDate,
    salaryMonthly: salary,
    status,
    currency: 'INR',
    emergencyContact: metadata,
  };
}

export function hrUploadCacheKey(tenantId: string, uploadId: string): string {
  return `hr:upload:${tenantId}:${uploadId}`;
}

export const HR_UPLOAD_TTL_SEC = 30 * 60;
