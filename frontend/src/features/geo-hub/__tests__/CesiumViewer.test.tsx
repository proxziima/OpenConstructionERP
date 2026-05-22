// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
/**
 * CesiumViewer tests. Mocks the dynamic ``import('cesium')`` so the
 * viewer initialises against a stub, then asserts:
 *
 * 1. The container is rendered.
 * 2. The Cesium loading/absent message is shown when ``cesium`` cannot
 *    be imported (community-build behaviour).
 * 3. The component cleans up on unmount (destroy() called).
 * 4. A tileset URL from ``mapConfig.tilesets`` triggers
 *    ``Cesium3DTileset.fromUrl(url)`` exactly once per tileset.
 * 5. The viewer flies to the anchor when present.
 */

import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CesiumViewer } from '../CesiumViewer';
import type { MapConfig } from '../types';

// Build a fresh stub per test so destroy() / fromUrl() spies are isolated.
function makeCesiumStub() {
  const flyTo = vi.fn();
  const destroy = vi.fn();
  const add = vi.fn();
  const fromUrl = vi.fn(async (url: string) => ({ url }));
  return {
    flyTo,
    destroy,
    add,
    fromUrl,
    module: {
      Viewer: vi.fn().mockImplementation(() => ({
        destroy,
        camera: { flyTo },
        scene: { primitives: { add } },
        shadows: false,
      })),
      Cartesian3: {
        fromDegrees: vi.fn((lon, lat, alt) => ({ lon, lat, alt })),
      },
      EllipsoidTerrainProvider: vi.fn(),
      Cesium3DTileset: { fromUrl },
    },
  };
}

afterEach(() => {
  vi.resetModules();
  cleanup();
});

describe('CesiumViewer', () => {
  it('renders a Cesium container element', async () => {
    vi.doMock('cesium', () => ({}));
    render(<CesiumViewer mode="global" />);
    const container = await screen.findByTestId('geo-hub-cesium-container');
    expect(container).toBeTruthy();
  });

  it('shows install hint when cesium import fails', async () => {
    // No vi.doMock — the missing import triggers the absent branch.
    render(<CesiumViewer mode="global" />);
    // After the visual elevation pass the absent state shows both a
    // heading and a paragraph mentioning Cesium, so target the
    // ``npm install cesium`` <code> element which is unique.
    await waitFor(() => {
      expect(screen.getByText('npm install cesium')).toBeInTheDocument();
    });
  });

  it('flies to the anchor when mapConfig has one', async () => {
    const stub = makeCesiumStub();
    vi.doMock('cesium', () => stub.module);
    const cfg: MapConfig = {
      project_id: 'p1',
      anchor: {
        id: 'a1',
        project_id: 'p1',
        lat: '52.52',
        lon: '13.40',
        alt: '10',
        epsg_code: 4326,
        region_code: 'DE-BE',
        address: null,
        accuracy_m: null,
        metadata: {},
        created_at: '',
        updated_at: '',
      },
      imagery_layers: [],
      terrain_source: null,
      tilesets: [],
      overlays: [],
      viewpoints: [],
      active_jobs: [],
    };
    render(<CesiumViewer mode="project" mapConfig={cfg} />);
    await waitFor(() => {
      expect(stub.flyTo).toHaveBeenCalled();
    });
  });

  it('attempts to load every ready tileset', async () => {
    const stub = makeCesiumStub();
    vi.doMock('cesium', () => stub.module);
    const cfg: MapConfig = {
      project_id: 'p1',
      anchor: null,
      imagery_layers: [],
      terrain_source: null,
      tilesets: [
        {
          id: 't1',
          project_id: 'p1',
          source_kind: 'bim_model',
          source_id: 's1',
          name: 'T1',
          bucket: '',
          prefix: '',
          tileset_json_uri: 'https://x/t1/tileset.json',
          bounding_volume: null,
          geometric_error: '50',
          tile_format: 'b3dm',
          tile_count: 1,
          total_bytes: 1000,
          status: 'ready',
          generated_at: null,
          generation_job_id: null,
          metadata: {},
          created_at: '',
          updated_at: '',
        },
        {
          id: 't2',
          project_id: 'p1',
          source_kind: 'bim_model',
          source_id: 's2',
          name: 'T2',
          bucket: '',
          prefix: '',
          tileset_json_uri: null,
          bounding_volume: null,
          geometric_error: '0',
          tile_format: 'b3dm',
          tile_count: 0,
          total_bytes: 0,
          status: 'draft',
          generated_at: null,
          generation_job_id: null,
          metadata: {},
          created_at: '',
          updated_at: '',
        },
      ],
      overlays: [],
      viewpoints: [],
      active_jobs: [],
    };
    render(<CesiumViewer mode="project" mapConfig={cfg} />);
    await waitFor(() => {
      expect(stub.fromUrl).toHaveBeenCalledWith(
        'https://x/t1/tileset.json',
      );
    });
    // The draft tileset (no URI) must not be requested.
    expect(stub.fromUrl).toHaveBeenCalledTimes(1);
  });

  it('destroys the viewer on unmount', async () => {
    const stub = makeCesiumStub();
    vi.doMock('cesium', () => stub.module);
    const { unmount } = render(<CesiumViewer mode="global" />);
    await waitFor(() => {
      expect(stub.module.Viewer).toHaveBeenCalled();
    });
    unmount();
    expect(stub.destroy).toHaveBeenCalled();
  });

  it('does not rebuild the viewer when only the mapConfig object reference changes', async () => {
    // Regression: React Query produces a new ``mapConfig`` reference on
    // every poll. The viewer effect must key off a stable signature
    // (anchor + ready-tileset uris) so a refetch with identical content
    // does NOT destroy and re-create the entire Cesium viewer — that
    // would wipe the user's camera state and re-download the 3 MB
    // runtime every 30 s.
    const stub = makeCesiumStub();
    vi.doMock('cesium', () => stub.module);
    const makeCfg = (): MapConfig => ({
      project_id: 'p1',
      anchor: {
        id: 'a1',
        project_id: 'p1',
        lat: '52.52',
        lon: '13.40',
        alt: '10',
        epsg_code: 4326,
        region_code: 'DE-BE',
        address: null,
        accuracy_m: null,
        metadata: {},
        created_at: '',
        updated_at: '',
      },
      imagery_layers: [],
      terrain_source: null,
      tilesets: [],
      overlays: [],
      viewpoints: [],
      active_jobs: [],
    });

    const { rerender } = render(
      <CesiumViewer mode="project" mapConfig={makeCfg()} />,
    );
    await waitFor(() => {
      expect(stub.module.Viewer).toHaveBeenCalledTimes(1);
    });
    // Identical content, fresh reference — must NOT rebuild.
    rerender(<CesiumViewer mode="project" mapConfig={makeCfg()} />);
    // Give any pending effect a tick to run; the viewer count must stay 1.
    await new Promise((r) => setTimeout(r, 50));
    expect(stub.module.Viewer).toHaveBeenCalledTimes(1);
  });
});
