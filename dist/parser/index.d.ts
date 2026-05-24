import type { OmmObject, MonoGroup } from '../types';
export interface ParseResult {
    objects: OmmObject[];
    monoGroups: Record<number, MonoGroup>;
    hasAnimation: boolean;
}
export declare function parseOMM(txt: string, getImg: (src: string) => HTMLImageElement): ParseResult;
