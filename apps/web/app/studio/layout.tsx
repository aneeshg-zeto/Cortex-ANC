import { StudioLayoutClient } from './studio-layout-client';

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <StudioLayoutClient>{children}</StudioLayoutClient>;
}
