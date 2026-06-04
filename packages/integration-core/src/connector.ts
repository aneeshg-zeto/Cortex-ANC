/** Cortex connector aliases – de-branded from Activepieces Piece framework */
export {
  Piece as Connector,
  createPiece as createConnector,
} from './framework/lib/piece';

export type { Piece as ConnectorDefinition } from './framework/lib/piece';

// Backward-compatible exports for copied Activepieces connector code
export { Piece, createPiece } from './framework/lib/piece';
export * from './framework/lib';
