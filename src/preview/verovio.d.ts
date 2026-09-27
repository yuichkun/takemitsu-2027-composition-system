// Minimal types for the parts of Verovio the preview uses.
declare module "verovio/wasm" {
  export default function createVerovioModule(): Promise<unknown>;
}
declare module "verovio/esm" {
  export class VerovioToolkit {
    constructor(module: unknown);
    setOptions(options: Record<string, unknown>): void;
    loadData(data: string): boolean;
    getPageCount(): number;
    renderToSVG(page: number): string;
    getElementsAtTime(milliseconds: number): { notes?: string[]; page?: number };
    getLog(): string;
    renderToMIDI(): string;
    /** Onset of an element in milliseconds from the start. */
    getTimeForElement(id: string): number;
  }
}
