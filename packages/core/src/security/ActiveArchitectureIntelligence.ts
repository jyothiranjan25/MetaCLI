/**
 * MetaCLI Core — Active Architecture Intelligence
 *
 * Scans relational file import topologies to analyze circular couplings,
 * dangerous modular weights, unused dead systems, and decay metrics.
 */

export interface CouplingReport {
  circularDependencies: string[][];
  couplingScores: Record<string, number>;
  decayingModules: string[];
}

export class ActiveArchitectureIntelligence {
  private eventBus: any;

  constructor(eventBus?: any) {
    this.eventBus = eventBus;
  }

  /**
   * Evaluates modularity structures and circular coupling chains.
   */
  analyzeHealth(dependencies: Array<{ sourcePath: string; targetPath: string }>): CouplingReport {
    const adjList = new Map<string, Set<string>>();
    const inDegree: Record<string, number> = {};

    // 1. Map imports list
    for (const dep of dependencies) {
      if (!adjList.has(dep.sourcePath)) {
        adjList.set(dep.sourcePath, new Set());
      }
      adjList.get(dep.sourcePath)!.add(dep.targetPath);
      
      inDegree[dep.targetPath] = (inDegree[dep.targetPath] || 0) + 1;
      if (inDegree[dep.sourcePath] === undefined) {
        inDegree[dep.sourcePath] = 0;
      }
    }

    // 2. Identify circular dependencies (DFS)
    const circularDependencies: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string, path: string[]) => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = adjList.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            dfs(neighbor, [...path]);
          } else if (recStack.has(neighbor)) {
            // Circle detected
            const circleIndex = path.indexOf(neighbor);
            if (circleIndex !== -1) {
              circularDependencies.push(path.slice(circleIndex));
            }
          }
        }
      }

      recStack.delete(node);
    };

    for (const node of adjList.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    // 3. Score coupling metrics
    const couplingScores: Record<string, number> = {};
    for (const node of Object.keys(inDegree)) {
      const outgoing = adjList.get(node)?.size ?? 0;
      const incoming = inDegree[node];
      // Instability index = Outgoing / (Incoming + Outgoing)
      couplingScores[node] = incoming + outgoing > 0 ? outgoing / (incoming + outgoing) : 0;
    }

    // 4. Identify decaying systems (dead nodes with high in-degrees but zero updates)
    const decayingModules = Object.entries(couplingScores)
      .filter(([_, score]) => score === 0 && (inDegree[_] || 0) > 3)
      .map(([node]) => node);

    if (this.eventBus) {
      this.eventBus.emit('architecture.analyzed', {
        circularCount: circularDependencies.length,
      });
    }

    return {
      circularDependencies,
      couplingScores,
      decayingModules,
    };
  }
}
