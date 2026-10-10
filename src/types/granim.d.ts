declare module "granim" {
  interface GranimState {
    gradients: string[][];
    transitionSpeed?: number;
    loop?: boolean;
  }

  interface GranimOptions {
    element: HTMLCanvasElement | string;
    direction?: string;
    isPausedWhenNotInView?: boolean;
    states: Record<string, GranimState>;
    defaultStateName?: string;
    stateTransitionSpeed?: number;
  }

  export default class Granim {
    constructor(options: GranimOptions);
    destroy(): void;
    pause(): void;
    play(): void;
    clear(): void;
  }
}
