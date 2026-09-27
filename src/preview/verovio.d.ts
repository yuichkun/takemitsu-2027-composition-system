// Minimal types for the parts of Verovio the engraver uses (src/preview/engrave.ts).
declare module "verovio/wasm" {
  export default function createVerovioModule(): Promise<unknown>;
}
declare module "verovio/esm" {
  export class VerovioToolkit {
    constructor(module: unknown);
    setOptions(options: Record<string, unknown>): void;
    loadData(data: string): boolean;
    getMEI(options?: Record<string, unknown>): string;
    getPageCount(): number;
    renderToSVG(page: number): string;
    getLog(): string;
    getVersion(): string;
    renderToTimemap(options?: Record<string, unknown>): {
      tstamp: number;
      qstamp: number;
      on?: string[];
      off?: string[];
      restsOn?: string[];
      restsOff?: string[];
    }[];
  }
  export const LOG_OFF: number;
  export function enableLog(level: number, module: unknown): void;
}
