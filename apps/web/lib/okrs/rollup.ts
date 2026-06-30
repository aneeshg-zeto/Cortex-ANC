import type { Objective } from './store';

export type OkrTreeNode = Objective & { children: OkrTreeNode[] };

/** Build a parent→child tree from a flat objectives list. */
export function buildOkrTree(objectives: Objective[]): OkrTreeNode[] {
  const byId = new Map<string, OkrTreeNode>();
  for (const o of objectives) byId.set(o.id, { ...o, children: [] });
  const roots: OkrTreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
