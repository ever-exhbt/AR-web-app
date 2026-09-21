/// <reference types="vite/client" />

declare module 'mind-ar/dist/mindar-image-three.prod.js';
declare module 'mind-ar/src/image-target/offline-compiler.js';

declare module 'virtual:ar-targets' {
  export const manifest: any;
  export const mindFile: string;
  export const targets: Array<{
    index: number;
    id: string;
    source: string;
    width: number;
    height: number;
    hash: string;
  }>;
  export function getTargetIndex(id: string): number;
  export function getTargetInfo(idOrIndex: string | number): any;
  export default manifest;
}
