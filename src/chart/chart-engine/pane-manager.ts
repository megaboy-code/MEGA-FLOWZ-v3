// ================================================================
// 📐 PANE MANAGER - Pane CRUD operations (FIXED)
// ================================================================

import { IChartApi, ISeriesApi, IPaneApi, SeriesType, Time } from 'lightweight-charts';

interface PaneInfo {
  pane: IPaneApi<Time>;
  height: number;
  visible: boolean;
  series: Map<string, ISeriesApi<SeriesType>>;
  id?: string;
}

export class PaneManager {
  private chart: IChartApi | null = null;
  private panes: Map<IPaneApi<Time>, PaneInfo> = new Map();
  private paneCounter: number = 0;

  // ==================== INITIALIZATION ====================

  public setChart(chart: IChartApi): void {
    this.chart = chart;
  }

  // ==================== PANE CRUD ====================

  public addPane(height: number = 120, id?: string): IPaneApi<Time> | null {
    if (!this.chart) {
      console.error('❌ Chart not initialized. Cannot add pane.');
      return null;
    }

    try {
      const pane = this.chart.addPane();
      pane.setHeight(height);
      
      const paneId = id || `pane_${this.paneCounter++}`;
      
      this.panes.set(pane, {
        pane: pane,
        height: height,
        visible: true,
        series: new Map(),
        id: paneId
      });

      console.log(`✅ Pane created: ${paneId} (index: ${pane.paneIndex()}, height: ${height}px)`);
      return pane;

    } catch (error) {
      console.error('❌ Failed to add pane:', error);
      return null;
    }
  }

  public removePane(pane: IPaneApi<Time>): boolean {
    if (!this.chart || !pane) return false;

    const paneInfo = this.panes.get(pane);
    if (!paneInfo) return false;

    try {
      // Remove all series from this pane first
      paneInfo.series.forEach((series, seriesId) => {
        try {
          this.chart!.removeSeries(series);
        } catch (e) {
          // Series might already be removed
        }
      });

      const paneIndex = pane.paneIndex();
      this.chart.removePane(paneIndex);
      this.panes.delete(pane);

      console.log(`✅ Pane removed: ${paneInfo.id || 'unknown'} (index: ${paneIndex})`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to remove pane:`, error);
      return false;
    }
  }

  public removePaneById(paneId: string): boolean {
    for (const [pane, info] of this.panes.entries()) {
      if (info.id === paneId) {
        return this.removePane(pane);
      }
    }
    console.warn(`⚠️ Pane not found with ID: ${paneId}`);
    return false;
  }

  // ✅ ADD THIS METHOD - Clears all panes
  public clearAllPanes(): void {
    if (!this.chart) return;
    
    // Get all panes and remove them
    const panesToRemove = Array.from(this.panes.keys());
    panesToRemove.forEach(pane => {
      this.removePane(pane);
    });
    
    this.panes.clear();
    this.paneCounter = 0;
    console.log('✅ All panes cleared');
  }

  // ==================== SERIES MANAGEMENT ====================

  public addSeriesToPane(
    pane: IPaneApi<Time>, 
    seriesType: any, 
    options?: any, 
    seriesId?: string
  ): ISeriesApi<SeriesType> | null {
    if (!this.chart || !pane) {
      console.error('❌ Chart or pane not available');
      return null;
    }

    const paneInfo = this.panes.get(pane);
    if (!paneInfo) {
      console.error(`❌ Pane not found in registry`);
      return null;
    }

    try {
      const paneIndex = pane.paneIndex();
      const series = this.chart.addSeries(seriesType, options, paneIndex);
      
      const uniqueId = seriesId || `series_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      paneInfo.series.set(uniqueId, series);

      console.log(`✅ Series added to pane ${paneInfo.id || 'unknown'} (${uniqueId})`);
      return series;

    } catch (error) {
      console.error(`❌ Failed to add series to pane:`, error);
      return null;
    }
  }

  // ==================== PANE PROPERTIES ====================

  public setPaneHeight(pane: IPaneApi<Time>, height: number): boolean {
    const paneInfo = this.panes.get(pane);
    if (!paneInfo) return false;

    try {
      pane.setHeight(height);
      paneInfo.height = height;
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to set pane height:`, error);
      return false;
    }
  }

  public setPaneVisibility(pane: IPaneApi<Time>, visible: boolean): boolean {
    const paneInfo = this.panes.get(pane);
    if (!paneInfo) return false;

    try {
      // Hide by making series invisible
      paneInfo.series.forEach((series, seriesId) => {
        try {
          series.applyOptions({ visible: visible });
        } catch (e) {
          // Ignore errors
        }
      });
      
      paneInfo.visible = visible;
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to set pane visibility:`, error);
      return false;
    }
  }

  public movePane(pane: IPaneApi<Time>, newIndex: number): boolean {
    try {
      pane.moveTo(newIndex);
      return true;
    } catch (error) {
      console.error(`❌ Failed to move pane:`, error);
      return false;
    }
  }

  // ==================== GETTERS ====================

  public getPaneInfo(pane: IPaneApi<Time>): PaneInfo | null {
    return this.panes.get(pane) || null;
  }

  public getAllPanes(): PaneInfo[] {
    return Array.from(this.panes.values());
  }

  public getPaneById(paneId: string): IPaneApi<Time> | null {
    for (const [pane, info] of this.panes.entries()) {
      if (info.id === paneId) {
        return pane;
      }
    }
    return null;
  }

  public getPaneHeight(pane: IPaneApi<Time>): number | null {
    try {
      return pane.getHeight();
    } catch (error) {
      console.error(`❌ Failed to get pane height:`, error);
      return null;
    }
  }

  public getPaneIndex(pane: IPaneApi<Time>): number | null {
    try {
      return pane.paneIndex();
    } catch (error) {
      console.error(`❌ Failed to get pane index:`, error);
      return null;
    }
  }

  // ==================== DESTROY ====================

  public destroy(): void {
    this.clearAllPanes(); // Use the new method
    this.chart = null;
  }
}