/**
 * @metacli/brain — Semantic Project Map Generator
 *
 * Scans index records to generate high-level architectural domain hierarchies
 * instead of shallow filesystem paths.
 */

export interface DomainNode {
  domainName: string;
  services: string[];
  children: DomainNode[];
}

export class SemanticProjectMapGenerator {
  /**
   * Generates a functional domain partition hierarchy mapping files into active domains.
   */
  generate(store: any): DomainNode {
    const root: DomainNode = {
      domainName: 'Root System',
      services: [],
      children: [],
    };

    try {
      const files = store.getAllFiles();
      const authSystem: DomainNode = { domainName: 'Auth Domain', services: [], children: [] };
      const dataSystem: DomainNode = { domainName: 'Data & Persistence Domain', services: [], children: [] };
      const uiSystem: DomainNode = { domainName: 'UI Presentation Domain', services: [], children: [] };

      for (const file of files) {
        const path = file.path.toLowerCase();
        if (path.includes('auth') || path.includes('jwt') || path.includes('session')) {
          authSystem.services.push(file.path);
        } else if (path.includes('db') || path.includes('store') || path.includes('persistence') || path.includes('sqlite')) {
          dataSystem.services.push(file.path);
        } else if (path.includes('ui') || path.includes('view') || path.includes('cli') || path.includes('dashboard')) {
          uiSystem.services.push(file.path);
        } else {
          root.services.push(file.path);
        }
      }

      if (authSystem.services.length > 0) root.children.push(authSystem);
      if (dataSystem.services.length > 0) root.children.push(dataSystem);
      if (uiSystem.services.length > 0) root.children.push(uiSystem);
    } catch {
      // Return bare root node if database query fails or indexes are unbuilt
    }

    return root;
  }
}
