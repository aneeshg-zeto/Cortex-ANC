import { EmployeeLayoutClient } from './employee-layout-client';

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return <EmployeeLayoutClient>{children}</EmployeeLayoutClient>;
}
