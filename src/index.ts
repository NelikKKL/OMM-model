import type { Camera, OmmObject, MonoGroup } from './types';
import { parseOMM }    from './parser';
import { Renderer }    from './renderer';
import { initControls } from './controls';
import { stepAnimation } from './animation';

class OmmModel extends HTMLElement {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private camera: Camera = { z: 600, rx: 0.4, ry: 0.4, cx: 0, cy: 0 };
  private objects: OmmObject[] = [];
  private monoGroups: Record<number, MonoGroup> = {};
  private textures: Record<string, HTMLImageElement> = {};
  private isAnimating = false;
  private animationRequested = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.canvas = document.createElement('canvas');
    this.renderer = new Renderer(this.canvas);
    this.shadowRoot!.appendChild(this.canvas);
  }

  connectedCallback(): void {
    this.canvas.style.cssText = 'width:100%;height:100%;display:block';
    if (this.hasAttribute('freer')) {
      initControls(
        this.canvas,
        this.camera,
        this.renderer.focal,
        () => this.isAnimating,
        () => this.render(),
      );
    }
    setTimeout(() => { this.resize(); this.loadContent(); }, 50);
  }

  private async loadContent(): Promise<void> {
    const content = this.getAttribute('src') || this.textContent?.trim() || '';
    if (content.endsWith('.omm')) {
      try {
        const res = await fetch(content);
        if (res.ok) this.parse(await res.text());
        else console.error(`OMM: failed to load ${content}`);
      } catch (e) {
        console.error('OMM:', e);
      }
    } else {
      this.parse(content);
    }

    if (this.hasAttribute('autorate') || this.isAnimating) {
      this.isAnimating = true;
      if (!this.animationRequested) {
        this.animationRequested = true;
        this.tick();
      }
    } else {
      this.render();
    }
  }

  private resize(): void {
    this.canvas.width  = this.offsetWidth  || 300;
    this.canvas.height = this.offsetHeight || 300;
  }

  private parse(txt: string): void {
    const { objects, monoGroups, hasAnimation } = parseOMM(txt, src => this.getImg(src));
    this.objects     = objects;
    this.monoGroups  = monoGroups;
    this.isAnimating = hasAnimation;
    this.render();
  }

  private getImg(src: string): HTMLImageElement {
    if (this.textures[src]) return this.textures[src];
    const img = new Image();
    img.src = src;
    img.onload = () => this.render();
    return (this.textures[src] = img);
  }

  private render(): void {
    this.renderer.render(this.objects, this.monoGroups, this.camera);
  }

  private tick(): void {
    if (!this.isAnimating) return;
    if (this.hasAttribute('autorate')) this.camera.ry += 0.01;
    stepAnimation(this.objects);
    this.render();
    requestAnimationFrame(() => this.tick());
  }
}

customElements.define('omm-model', OmmModel);

export { OmmModel };
