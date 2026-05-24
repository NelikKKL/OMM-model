declare class OmmModel extends HTMLElement {
    private canvas;
    private renderer;
    private camera;
    private objects;
    private monoGroups;
    private textures;
    private isAnimating;
    private animationRequested;
    constructor();
    connectedCallback(): void;
    private loadContent;
    private resize;
    private parse;
    private getImg;
    private render;
    private tick;
}
export { OmmModel };
