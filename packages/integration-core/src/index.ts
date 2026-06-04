import { createConnector } from './connector-factory';
import { slack as slackDefinition } from './connectors/slack';
import { gmail as gmailDefinition } from './connectors/gmail';
import { github as githubDefinition } from './connectors/github';
import { linear as linearDefinition } from './connectors/linear';
import { notion as notionDefinition } from './connectors/notion';

export { createConnector } from './connector-factory';
export type { CallableConnector, CallableConnectorAction, ConnectorRunContext } from './connector-factory';

export const slackConnector = createConnector(slackDefinition);
export const gmailConnector = createConnector(gmailDefinition);
export const githubConnector = createConnector(githubDefinition);
export const linearConnector = createConnector(linearDefinition);
export const notionConnector = createConnector(notionDefinition);

export {
  slackDefinition,
  gmailDefinition,
  githubDefinition,
  linearDefinition,
  notionDefinition,
};
