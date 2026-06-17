import { HrLayoutClient } from './hr-layout-client';

export default function HrLayout({ children }: { children: React.ReactNode }) {
  return <HrLayoutClient>{children}</HrLayoutClient>;
}
