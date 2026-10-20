import type { ReactElement } from 'react';

import { QueryBoundary } from '@/components/ui';

/** `screenLayout` for every navigator: each screen gets a loading skeleton and an error state. */
export function queryScreenLayout({ children }: { children: ReactElement }) {
  return <QueryBoundary>{children}</QueryBoundary>;
}
