import { ExecutionType } from './shared-stubs';
import type { Action } from './framework/lib/action/action';
import type { Piece } from './framework/lib/piece';

export interface ConnectorRunContext {
  auth: unknown;
  props: Record<string, unknown>;
}

export interface CallableConnectorAction {
  name: string;
  displayName: string;
  description: string;
  run: (context: ConnectorRunContext) => Promise<unknown>;
}

export interface CallableConnector {
  displayName: string;
  description: string;
  actions: Record<string, CallableConnectorAction>;
  triggers: Record<string, { name: string; displayName: string; description: string }>;
}

function createStubContext(auth: unknown, props: Record<string, unknown>) {
  const noop = async () => undefined;
  const noopSync = () => undefined;

  return {
    auth,
    propsValue: props,
    executionType: ExecutionType.BEGIN,
    flows: {
      list: async () => ({ data: [] }),
      current: { id: 'cortex-flow', version: { id: 'v1' } },
    },
    step: { name: 'cortex-step' },
    store: {
      put: async <T>(_: string, value: T) => value,
      get: async () => null,
      delete: noop,
    },
    project: { id: 'cortex-project', externalId: async () => undefined },
    connections: { get: async () => null },
    tags: { add: noop },
    server: { apiUrl: 'http://localhost:3000', publicUrl: 'http://localhost:3000', token: '' },
    files: { write: async () => 'file-id' },
    output: { update: noop },
    agent: { tools: async () => ({}) },
    run: {
      id: 'run-id',
      stop: noopSync,
      respond: noopSync,
      createWaitpoint: async () => ({
        id: 'wp',
        resumeUrl: '',
        buildResumeUrl: () => '',
      }),
      waitForWaitpoint: noopSync,
    },
    resumePayload: { queryParams: {} },
  };
}

function wrapAction(action: Action): CallableConnectorAction {
  return {
    name: action.name,
    displayName: action.displayName,
    description: action.description,
    run: async (context: ConnectorRunContext) =>
      action.run(createStubContext(context.auth, context.props) as Parameters<Action['run']>[0]),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createConnector(definition: Piece<any>): CallableConnector {
  const rawActions = definition.actions();
  const actions: Record<string, CallableConnectorAction> = {};

  for (const [name, action] of Object.entries(rawActions)) {
    actions[name] = wrapAction(action);
  }

  // Friendly alias used by Cortex API
  if (actions.send_channel_message && !actions.send_message) {
    actions.send_message = actions.send_channel_message;
  }

  const rawTriggers = definition.triggers();
  const triggers: CallableConnector['triggers'] = {};
  for (const [name, trigger] of Object.entries(rawTriggers)) {
    triggers[name] = {
      name: trigger.name,
      displayName: trigger.displayName,
      description: trigger.description,
    };
  }

  return {
    displayName: definition.displayName,
    description: definition.description,
    actions,
    triggers,
  };
}
