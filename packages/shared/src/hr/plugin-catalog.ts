export type HrPluginDefinition = {
  id: string;
  name: string;
  description: string;
  category: 'hris' | 'payroll' | 'attendance';
  website: string;
  comingSoon?: boolean;
};

export const HR_PLUGIN_CATALOG: HrPluginDefinition[] = [
  {
    id: 'darwinbox',
    name: 'Darwinbox',
    description: 'Enterprise HRMS — employees, payroll, attendance, and org structure',
    category: 'hris',
    website: 'https://darwinbox.com',
  },
  {
    id: 'keka',
    name: 'Keka',
    description: 'HR, payroll, and leave management for growing teams',
    category: 'hris',
    website: 'https://www.keka.com',
  },
  {
    id: 'greythr',
    name: 'greytHR',
    description: 'Payroll, compliance, and employee lifecycle for India',
    category: 'payroll',
    website: 'https://www.greythr.com',
  },
  {
    id: 'zoho-people',
    name: 'Zoho People',
    description: 'Leave, attendance, and employee records',
    category: 'hris',
    website: 'https://www.zoho.com/people',
    comingSoon: true,
  },
  {
    id: 'bamboohr',
    name: 'BambooHR',
    description: 'Employee data, time-off, and reporting',
    category: 'hris',
    website: 'https://www.bamboohr.com',
    comingSoon: true,
  },
];

export function getHrPluginById(id: string): HrPluginDefinition | undefined {
  return HR_PLUGIN_CATALOG.find((p) => p.id === id);
}
