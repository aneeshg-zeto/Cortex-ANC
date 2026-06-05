import pg from 'pg';

const { Pool } = pg;

export type GraphNode = {
  id: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  properties: Record<string, unknown>;
};

export class GraphClient {
  private pool: pg.Pool;

  constructor(connectionString?: string) {
    this.pool = new Pool({
      connectionString: connectionString ?? process.env.DATABASE_URL,
    });
  }

  async upsertNode(node: Omit<GraphNode, 'id'> & { id?: string }): Promise<string> {
    const id = node.id ?? `${node.type}:${node.label}`.toLowerCase().replace(/\s+/g, '-');
    await this.pool.query(
      `INSERT INTO cortex_nodes (id, label, type, properties)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         label = EXCLUDED.label,
         properties = EXCLUDED.properties,
         updated_at = NOW()`,
      [id, node.label, node.type, node.properties],
    );
    return id;
  }

  async upsertEdge(edge: Omit<GraphEdge, 'id'> & { id?: string }): Promise<string> {
    const id = edge.id ?? `${edge.fromId}-${edge.type}-${edge.toId}`;
    await this.pool.query(
      `INSERT INTO cortex_edges (id, from_id, to_id, type, properties)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET properties = EXCLUDED.properties`,
      [id, edge.fromId, edge.toId, edge.type, edge.properties],
    );
    return id;
  }

  async findNodesByLabel(query: string, limit = 10): Promise<GraphNode[]> {
    const result = await this.pool.query<{
      id: string;
      label: string;
      type: string;
      properties: Record<string, unknown>;
    }>(
      `SELECT id, label, type, properties FROM cortex_nodes
       WHERE label ILIKE $1 OR properties::text ILIKE $1
       LIMIT $2`,
      [`%${query}%`, limit],
    );
    return result.rows;
  }

  async traverse(fromId: string, depth = 2): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const center = await this.pool.query<GraphNode>(
      `SELECT id, label, type, properties FROM cortex_nodes WHERE id = $1`,
      [fromId],
    );
    const edgesResult = await this.pool.query<{
      id: string;
      from_id: string;
      to_id: string;
      type: string;
      properties: Record<string, unknown>;
    }>(
      `WITH RECURSIVE walk AS (
         SELECT id, from_id, to_id, type, properties, 1 AS lvl
         FROM cortex_edges
         WHERE from_id = $1 OR to_id = $1
         UNION
         SELECT e.id, e.from_id, e.to_id, e.type, e.properties, w.lvl + 1
         FROM cortex_edges e
         JOIN walk w ON e.from_id = w.to_id OR e.to_id = w.from_id
         WHERE w.lvl < $2
       )
       SELECT DISTINCT id, from_id, to_id, type, properties FROM walk
       LIMIT 100`,
      [fromId, depth],
    );
    const nodeIds = new Set<string>([fromId]);
    for (const e of edgesResult.rows) {
      nodeIds.add(e.from_id);
      nodeIds.add(e.to_id);
    }
    const nodesResult = await this.pool.query<GraphNode>(
      `SELECT id, label, type, properties FROM cortex_nodes WHERE id = ANY($1)`,
      [[...nodeIds]],
    );
    return {
      nodes: nodesResult.rows.length ? nodesResult.rows : center.rows,
      edges: edgesResult.rows.map((r) => ({
        id: r.id,
        fromId: r.from_id,
        toId: r.to_id,
        type: r.type,
        properties: r.properties,
      })),
    };
  }

  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<pg.QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
