// ================================================================
// ⚡ CHART STATE - Loading states and blur overlay
// ================================================================

import { ChartState } from '../chart-types';

export class ChartStateManager {
  private state: ChartState = 'IDLE';
  private container: HTMLElement | null = null;
  private blurOverlay: HTMLElement | null = null;
  private onStateChangeCallback: ((state: ChartState) => void) | null = null;

  constructor(container?: HTMLElement) {
    if (container) {
      this.setContainer(container);
    }
  }

  public setContainer(container: HTMLElement): void {
    console.log('📊 ChartStateManager: Setting container', container);
    this.container = container;
    this.createBlurOverlay();
  }

  private createBlurOverlay(): void {
    if (!this.container) return;

    this.removeBlurOverlay();

    this.blurOverlay = document.createElement('div');
    this.blurOverlay.className = 'chart-blur-overlay';
    this.blurOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.15s ease;
      pointer-events: none;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 32px;
      height: 32px;
      border: 3px solid rgba(255, 255, 255, 0.2);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      opacity: 0;
      transition: opacity 0.15s ease;
    `;

    this.blurOverlay.appendChild(spinner);
    this.container.appendChild(this.blurOverlay);
    this.injectStyles();
  }

  private injectStyles(): void {
    if (document.querySelector('#chart-state-styles')) return;

    const style = document.createElement('style');
    style.id = 'chart-state-styles';
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  private removeBlurOverlay(): void {
    if (this.blurOverlay && this.blurOverlay.parentNode) {
      this.blurOverlay.parentNode.removeChild(this.blurOverlay);
      this.blurOverlay = null;
    }
  }

  // ✅ No DOM event dispatch — callback only
  public setState(newState: ChartState): void {
    if (this.state === newState) return;

    console.log(`📊 Chart state: ${this.state} → ${newState}`);
    this.state = newState;
    this.updateBlurVisibility();

    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.state);
    }
  }

  public getState(): ChartState {
    return this.state;
  }

  public isLoading(): boolean {
    return this.state === 'LOADING';
  }

  public isReady(): boolean {
    return this.state === 'READY';
  }

  private updateBlurVisibility(): void {
    if (!this.blurOverlay || !this.container) return;

    const isBlurred = this.state === 'LOADING';

    this.blurOverlay.style.opacity = isBlurred ? '1' : '0';
    this.blurOverlay.style.pointerEvents = isBlurred ? 'auto' : 'none';
    this.container.style.cursor = isBlurred ? 'wait' : '';

    const spinner = this.blurOverlay.firstChild as HTMLElement;
    if (spinner) {
      spinner.style.opacity = isBlurred ? '1' : '0';
    }
  }

  public onStateChange(callback: (state: ChartState) => void): void {
    this.onStateChangeCallback = callback;
  }

  public hideBlur(): void {
    if (!this.blurOverlay) return;

    this.blurOverlay.style.opacity = '0';
    this.blurOverlay.style.pointerEvents = 'none';

    const spinner = this.blurOverlay.firstChild as HTMLElement;
    if (spinner) {
      spinner.style.opacity = '0';
    }
  }

  public destroy(): void {
    this.removeBlurOverlay();
    this.onStateChangeCallback = null;
    this.container = null;
  }
}