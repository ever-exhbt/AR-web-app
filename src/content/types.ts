export type ItemType = 'model' | 'video' | 'image' | 'text';

export interface BaseItem {
  type: ItemType;
  position?: [number, number, number]; // [x, y, z] relative to target center
  rotation?: [number, number, number]; // [x, y, z] in degrees
  scale?: number | [number, number, number];
}

export interface ModelItem extends BaseItem {
  type: 'model';
  src: string;
  animation?: 'auto' | string;
}

export interface VideoItem extends BaseItem {
  type: 'video';
  src: string;
  poster?: string;
  width?: number; // target width fraction (default 1)
  loop?: boolean;
}

export interface ImageItem extends BaseItem {
  type: 'image';
  src: string;
  width?: number; // target width fraction (default 1)
}

export interface TextItem extends BaseItem {
  type: 'text';
  text: string;
  width?: number;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  align?: 'left' | 'center' | 'right';
}

export type ExperienceItem = ModelItem | VideoItem | ImageItem | TextItem;

export interface InfoCardConfig {
  heading: string;
  body: string;
}

export interface TargetExperience {
  title?: string;
  items?: ExperienceItem[];
  infoCard?: InfoCardConfig;
}

export type ExperiencesConfig = Record<string, TargetExperience>;

export interface RenderableItem {
  object3d: import('three').Object3D;
  play?: () => void;
  pause?: () => void;
  update?: (delta: number) => void;
  dispose: () => void;
}
