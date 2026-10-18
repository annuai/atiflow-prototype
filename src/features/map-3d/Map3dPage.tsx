import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from '@untitledui/icons';
import { Skeleton } from '@/components/skeleton/Skeleton';
import { ButtonGroup, ButtonGroupItem } from '@/components/base/button-group/button-group';
import { EmptyState } from '@/components/data/EmptyState';
import { Engine } from '@/engine/Engine';
import { webGlProblem } from '@/engine/support';
import { reportError } from '@/platform';
import { localized } from '@/i18n';
import { originGizmo } from '@/engine/originGizmo';
import { useAuth } from '@/features/auth';
import { draftOf, latestOf, mapVersionsStore, useMapVersions, type MapData } from '@/features/map-editor';
import { useMap } from '@/features/maps';
import { Cube01 } from '@untitledui/icons';
import { copy } from './copy';
import { DwgPanel } from './DwgPanel';
import { navOf, siteOf, type WallSource } from './siteOf';
import { PageCard } from '@/components/data/PageCard';

/**
 * A map in 3D (`/configurator/maps/:id/3d`): the walls and machines estimated from the lidar grid, or the client's DWG laid over it. The same 3D scene as the Live Floor, with its lane map and
 * stations. The DWG is aligned in the side panel and saved into the draft.
 */
export function Map3dPage() {
  const { id = '' } = useParams();
  const map = useMap(id);
  const user = useAuth((s) => s.user)!;
  const history = useMapVersions((s) => s.byMap[id]);
  const draft = draftOf(history);
  const current = draft ?? latestOf(history);
  const data: MapData | undefined = current?.data;
  const [source, setSource] = useState<WallSource>(data?.dwg ? 'dwg' : 'lidar');
  const site = useMemo(() => (data && map ? siteOf(map.name, data, source) : null), [data, map, source]);
  const nav = useMemo(() => (data ? navOf(data) : null), [data]);
  const holder = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [noGl, setNoGl] = useState(() => webGlProblem() !== null);

  useEffect(() => {
    if (noGl || !site || !nav || !holder.current) return;
    let eng: Engine;
    try {
      eng = new Engine(holder.current);
    } catch (e) {
      reportError(e, { where: 'map-3d-engine' });
      queueMicrotask(() => setNoGl(true)); // (not synchronously inside the effect)
      return;
    }
    eng.load(site, nav);
    eng.scene.add(
      originGizmo(
        Math.max(3, 0.1 * Math.max(site.bounds.maxX - site.bounds.minX, site.bounds.maxY - site.bounds.minY)),
      ),
    ); // a tenth of the map, so it reads at any size
    setReady(true); // eslint-disable-line react-hooks/set-state-in-effect -- the scene is an external system built in this effect; `ready` only hides the loading skeleton
    return () => {
      eng.dispose();
      setReady(false);
    };
  }, [site, nav, noGl]);

  if (!map) return <Navigate to="/configurator/maps" replace />;
  if (noGl)
    return (
      <div className="content">
        <PageCard>
          <EmptyState
            icon={Cube01}
            title={localized('common').noWebgl.title}
            subtext={localized('common').noWebgl.body}
          />
        </PageCard>
      </div>
    );
  if (!data)
    return (
      <div className="content">
        <PageCard className="p-4">
          <Skeleton className="h-[420px] w-full" />
        </PageCard>
      </div>
    );
  const canEdit = draft !== undefined;
  const hasDwg = !!data.dwg;
  return (
    <div className="content">
      <PageCard>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary px-4 py-2">
          <div className="flex items-center gap-3">
            <Link
              to={`/configurator/maps/${id}`}
              className="flex items-center gap-1.5 text-sm font-medium text-tertiary hover:text-secondary"
            >
              <ArrowLeft className="size-4" />
              {copy.view3d.back}
            </Link>
            <span className="h-4 w-px bg-border-primary" aria-hidden />
            <span className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Cube01 className="size-4" />
              {copy.view3d.title}
            </span>
            <span className="text-sm text-brand-secondary">{map.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-secondary">
            {copy.view3d.wallsFrom}
            <ButtonGroup
              size="sm"
              aria-label={copy.view3d.wallsFrom}
              selectedKeys={[source]}
              onSelectionChange={(k) => {
                const v = [...k][0];
                if (v) setSource(v as WallSource);
              }}
            >
              <ButtonGroupItem id="lidar">{copy.view3d.lidar}</ButtonGroupItem>
              <ButtonGroupItem id="dwg" isDisabled={!hasDwg}>
                {copy.view3d.dwg}
              </ButtonGroupItem>
            </ButtonGroup>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="relative min-h-[360px] min-w-0 flex-1">
            {site ? (
              <>
                <div ref={holder} className="absolute inset-0" />
                {!ready && <Skeleton className="absolute inset-0 rounded-none" />}
                <p className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-primary/90 px-2 py-1 text-xs text-secondary shadow-xs ring-1 ring-secondary">
                  {copy.view3d.summary(site.walls.length, site.equipment.length)}
                </p>
              </>
            ) : (
              <EmptyState icon={Cube01} title={copy.view3d.title} subtext={copy.view3d.empty} size="md" />
            )}
          </div>
          <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-secondary p-4 lg:w-[340px] lg:border-t-0 lg:border-l">
            <p className="text-xs text-tertiary">{copy.view3d.estimate}</p>
            {data.structure && (
              <DwgPanel
                key={current?.id}
                data={data}
                canEdit={canEdit}
                onEditDraft={() => mapVersionsStore.getState().startDraft(id, user.name)}
                onSave={(dwg) => {
                  mapVersionsStore.getState().updateDraft(id, (d) => {
                    const { dwg: _old, ...rest } = d;
                    return dwg ? { ...rest, dwg } : rest;
                  });
                  setSource(dwg ? 'dwg' : 'lidar');
                }}
              />
            )}
          </aside>
        </div>
      </PageCard>
    </div>
  );
}
