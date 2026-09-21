declare module 'virtual:ar-targets' {
  export interface TargetManifestEntry {
    index: number;
    id: string;
    source: string;
    width: number;
    height: number;
    hash: string;
  }

  export interface TargetsManifest {
    mindFile: string;
    targets: TargetManifestEntry[];
  }

  export const manifest: TargetsManifest;
  export const mindFile: string;
  export const targets: TargetManifestEntry[];
  export function getTargetIndex(id: string): number;
  export function getTargetInfo(idOrIndex: string | number): TargetManifestEntry | undefined;

  const defaultExport: TargetsManifest;
  export default defaultExport;
}
