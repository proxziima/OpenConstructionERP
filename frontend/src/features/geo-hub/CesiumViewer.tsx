// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
/**
 * CesiumJS viewer wrapper.
 *
 * Lazy-loaded — the dynamic import that lands this module also pulls
 * the Cesium runtime. Keeping the bundle isolated is enforced by the
 * Vite ``manualChunks`` rule in ``vite.config.ts`` which routes
 * ``node_modules/cesium*`` to its own ``vendor-cesium`` chunk.
 *
 * Defensive guards:
 *
 * * Cesium is imported via ``import('cesium')`` so a missing optional
 *   dependency (the community installer does not auto-install Cesium)
 *   never crashes the rest of the app. When Cesium is absent we render
 *   a friendly install hint instead.
 * * ``viewer.destroy()`` is wired to the effect cleanup — no DOM leak
 *   on route change.
 * * Tileset loading falls back silently when ``tileset_json_uri`` is
 *   absent so a freshly-anchored project doesn't error out.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe2, Download } from 'lucide-react';

import type { MapConfig } from './types';

type ViewerMode = 'global' | 'project' | 'development';

interface CesiumViewerProps {
  mode: ViewerMode;
  mapConfig?: MapConfig;
  /**
   * Optional overlay rendered above the Cesium canvas (HUD, empty
   * states, custom badges). Rendered inside the same relative wrapper
   * so absolute-positioned children compose naturally.
   *
   * Purely a chrome hook — does not touch viewer lifecycle.
   */
  overlay?: ReactNode;
}

/** Stable signature for the viewer effect: rebuild only when the
 * inputs that actually matter for the Cesium scene change. Without
 * this, React Query produces a fresh ``mapConfig`` reference every
 * refetch (every 30 s on stale revalidation) which would tear down
 * the entire Cesium viewer — wiping camera state and forcing the
 * ~3 MB runtime to reinitialise.
 */
function _viewerSignature(
  mode: ViewerMode,
  mapConfig?: MapConfig,
): string {
  if (!mapConfig) return `${mode}|nil`;
  const anchor = mapConfig.anchor
    ? `${mapConfig.anchor.lat},${mapConfig.anchor.lon},${mapConfig.anchor.alt}`
    : 'nil';
  const tilesets = (mapConfig.tilesets ?? [])
    .filter((t) => t.status === 'ready' && t.tileset_json_uri)
    .map((t) => `${t.id}:${t.tileset_json_uri}`)
    .sort()
    .join(';');
  return `${mode}|${mapConfig.project_id ?? ''}|${anchor}|${tilesets}`;
}

interface CesiumLike {
  Viewer: new (
    container: HTMLElement,
    options?: Record<string, unknown>,
  ) => {
    destroy: () => void;
    camera: {
      flyTo: (options: { destination: unknown }) => void;
    };
    scene: {
      primitives: { add: (p: unknown) => unknown };
    };
    shadows: boolean;
  };
  Cartesian3: {
    fromDegrees: (lon: number, lat: number, alt: number) => unknown;
  };
  EllipsoidTerrainProvider: new () => unknown;
  Cesium3DTileset: {
    fromUrl: (url: string) => Promise<unknown>;
  };
}

async function loadCesium(): Promise<CesiumLike | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = (await import('cesium')) as any;
    // Cesium ships the runtime constructors on the module namespace itself
    // when imported via ESM. If the bundler resolved something that does not
    // expose ``Viewer``, the viewer init will throw — degrade gracefully and
    // log a diagnostic so we don't silently fall into "CesiumJS is not
    // installed" mode while the package is actually present.
    if (mod && typeof mod.Viewer !== 'function') {
      // eslint-disable-next-line no-console
      console.warn('[geo_hub] cesium import resolved but Viewer constructor is missing', Object.keys(mod || {}).slice(0, 10));
      return null;
    }
    return mod as CesiumLike;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[geo_hub] cesium dynamic import failed', err);
    return null;
  }
}

export function CesiumViewer({ mode, mapConfig, overlay }: CesiumViewerProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<ReturnType<CesiumLike['Viewer']['prototype']['destroy']> | null>(
    null,
  ) as { current: { destroy: () => void } | null };
  const [cesiumStatus, setCesiumStatus] = useState<
    'pending' | 'loaded' | 'absent'
  >('pending');

  // Stable string signature of the viewer-relevant inputs. Re-running
  // the effect on every parent re-render (React Query returns a new
  // ``mapConfig`` object reference on each refetch) would destroy and
  // re-create the entire Cesium viewer — wiping camera state and
  // re-downloading the 3 MB runtime.
  const signature = useMemo(
    () => _viewerSignature(mode, mapConfig),
    [mode, mapConfig],
  );

  useEffect(() => {
    let disposed = false;
    let viewer: { destroy: () => void } | null = null;

    (async () => {
      const cesium = await loadCesium();
      if (!cesium || disposed) {
        setCesiumStatus(cesium ? 'loaded' : 'absent');
        return;
      }
      const container = containerRef.current;
      if (!container) {
        setCesiumStatus('absent');
        return;
      }
      try {
        // Default to the ellipsoid terrain provider — zero-cost, no
        // ion key required. Enterprise customers wire their own ion
        // token via the Terrain admin page; we surface it through
        // the map-config bundle for them.
        const v = new cesium.Viewer(container, {
          terrainProvider: new cesium.EllipsoidTerrainProvider(),
          baseLayerPicker: false,
          timeline: mode === 'project' || mode === 'development',
          animation: mode === 'project' || mode === 'development',
          shouldAnimate: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: true,
          sceneModePicker: false,
        });
        viewer = v;
        viewerRef.current = v;
        v.shadows = true;

        if (mapConfig?.anchor) {
          const lat = Number(mapConfig.anchor.lat);
          const lon = Number(mapConfig.anchor.lon);
          const alt = Number(mapConfig.anchor.alt || 200);
          v.camera.flyTo({
            destination: cesium.Cartesian3.fromDegrees(
              lon, lat, Math.max(alt + 500, 1500),
            ),
          });
        }
        if (mapConfig?.tilesets) {
          for (const ts of mapConfig.tilesets) {
            if (ts.status !== 'ready' || !ts.tileset_json_uri) continue;
            try {
              const tileset = await cesium.Cesium3DTileset.fromUrl(
                ts.tileset_json_uri,
              );
              if (disposed) break;
              v.scene.primitives.add(tileset);
            } catch (err) {
              // One bad tileset must not kill the viewer.
              // eslint-disable-next-line no-console
              console.warn('[geo_hub] Tileset load failed', ts.id, err);
            }
          }
        }
        setCesiumStatus('loaded');
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[geo_hub] Cesium viewer init failed', err);
        setCesiumStatus('absent');
      }
    })();

    return () => {
      disposed = true;
      if (viewer) {
        try {
          viewer.destroy();
        } catch {
          /* viewer already gone — ignore */
        }
      }
      viewerRef.current = null;
    };
    // ``signature`` collapses ``mapConfig`` into a stable string that
    // only changes when something the viewer actually renders changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        data-testid="geo-hub-cesium-container"
        className="h-full w-full bg-slate-900"
      />
      {cesiumStatus === 'pending' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/40 text-sm text-slate-200 backdrop-blur-sm">
          <div className="relative">
            <Globe2
              size={28}
              strokeWidth={1.5}
              className="text-emerald-300/80 animate-pulse"
            />
            <span
              aria-hidden
              className="absolute -inset-2 rounded-full bg-emerald-400/10 blur-xl"
            />
          </div>
          <span className="font-medium tracking-wide">
            {t('geo_hub.cesium_loading', {
              defaultValue: 'Loading Cesium...',
            })}
          </span>
          <span className="text-xs text-slate-400">
            {t('geo_hub.cesium_loading_hint', {
              defaultValue: 'Streaming the 3D globe runtime (~3 MB).',
            })}
          </span>
        </div>
      )}
      {cesiumStatus === 'absent' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-slate-900/70 p-6 text-center text-slate-100 shadow-xl backdrop-blur-md ring-1 ring-white/5">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 opacity-60 blur-2xl ring-1 ring-amber-400/20"
            />
            <div className="relative">
              <div className="mx-auto mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30">
                <Download size={18} strokeWidth={2} />
              </div>
              <h3 className="text-base font-semibold text-white">
                {t('geo_hub.cesium_not_installed_title', {
                  defaultValue: 'CesiumJS is not installed',
                })}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                {t('geo_hub.cesium_not_installed', {
                  defaultValue:
                    'CesiumJS is not installed in this build. Geo viewer is in degraded mode.',
                })}
              </p>
              <code className="mt-4 inline-block rounded-sm bg-slate-800/80 px-2 py-1 font-mono text-xs text-slate-200 ring-1 ring-white/10">
                npm install cesium
              </code>
            </div>
          </div>
        </div>
      )}
      {/* Overlay slot — HUD, empty states, badges. Mounted last so it
          paints over the canvas; ``cesium`` canvas listens for input
          via its own event handlers and is therefore unaffected by
          ``pointer-events-none`` placement of HUD chrome above it. */}
      {overlay}
    </div>
  );
}

export default CesiumViewer;
