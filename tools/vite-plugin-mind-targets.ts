import type { Plugin, ViteDevServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { compileTargets, syncContentAssets } from './compile-targets/compile.js';

const VIRTUAL_MODULE_ID = 'virtual:ar-targets';
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;

export function mindTargetsPlugin(): Plugin {
  let isCompiling = false;
  let recompileTimeout: NodeJS.Timeout | null = null;

  function loadManifest() {
    const manifestPath = path.resolve('public/targets-manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (e) {
        console.error('[vite-plugin-mind-targets] Failed to parse targets-manifest.json:', e);
      }
    }
    return { mindFile: '', targets: [] };
  }

  return {
    name: 'vite-plugin-mind-targets',

    // Run compiler on build start
    async buildStart() {
      await compileTargets();
    },

    // Handle virtual module import
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
      return null;
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        const manifest = loadManifest();
        return `
export const manifest = ${JSON.stringify(manifest, null, 2)};
export const mindFile = manifest.mindFile;
export const targets = manifest.targets;

/**
 * Resolves target index from target ID. Never hard-code an anchor index!
 */
export function getTargetIndex(id) {
  const target = targets.find(t => t.id === id);
  return target ? target.index : -1;
}

/**
 * Resolves target metadata by ID or index
 */
export function getTargetInfo(idOrIndex) {
  if (typeof idOrIndex === 'number') {
    return targets.find(t => t.index === idOrIndex);
  }
  return targets.find(t => t.id === idOrIndex);
}

export default manifest;
`;
      }
      return null;
    },

    // Configure live file watcher during dev
    configureServer(server: ViteDevServer) {
      const targetsDir = path.resolve('targets');
      const experiencesFile = path.resolve('content/experiences.json');
      const contentAssetsDir = path.resolve('content/assets');

      const triggerRecompileAndReload = async () => {
        if (isCompiling) return;
        isCompiling = true;

        try {
          console.log('\n[vite-plugin-mind-targets] Targets directory changed. Recompiling .mind file...');
          await compileTargets({ force: true });

          // Invalidate virtual module in Vite cache
          const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
          }

          // Trigger full browser reload
          server.ws.send({
            type: 'full-reload',
            path: '*'
          });
          console.log('[vite-plugin-mind-targets] Recompile complete. Page reloaded.');
        } catch (err: any) {
          console.error('[vite-plugin-mind-targets] Compilation failed:', err.message || err);
        } finally {
          isCompiling = false;
        }
      };

      const handleFileChange = (filePath: string) => {
        const normalized = path.resolve(filePath);
        if (normalized.startsWith(contentAssetsDir)) {
          if (recompileTimeout) clearTimeout(recompileTimeout);
          // 400ms debounce to allow multi-megabyte video/model copy operations to release locks
          recompileTimeout = setTimeout(() => {
            try {
              console.log('[vite-plugin-mind-targets] Syncing content/assets to public/content/assets...');
              syncContentAssets();
              server.ws.send({ type: 'full-reload', path: '*' });
            } catch (err: any) {
              console.warn('[vite-plugin-mind-targets] Asset sync deferred:', err.message || err);
            }
          }, 400);
          return;
        }


        if (normalized.startsWith(targetsDir) || normalized === experiencesFile) {
          if (recompileTimeout) clearTimeout(recompileTimeout);
          // 250ms debounce to allow multi-file drag-and-drop operations
          recompileTimeout = setTimeout(triggerRecompileAndReload, 250);
        }
      };

      server.watcher.on('add', handleFileChange);
      server.watcher.on('unlink', handleFileChange);
      server.watcher.on('change', handleFileChange);
    }

  };
}
