import { z } from 'zod';
import { BasePropertySchema, TPropertyValue } from './common';
import { PropertyType } from './property-type';
import { MarkdownVariant } from '@cortex/integration-core/shared-stubs';

export const MarkDownProperty = z.object({
  ...BasePropertySchema.shape,
  ...TPropertyValue(z.void(), PropertyType.MARKDOWN).shape,
});

export type MarkDownProperty = BasePropertySchema &
  TPropertyValue<
    undefined,
    PropertyType.MARKDOWN,
    false
  > & {
    variant?: MarkdownVariant;
  };
