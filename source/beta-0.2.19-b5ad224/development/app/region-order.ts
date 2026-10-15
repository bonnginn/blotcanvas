export type OrderedRegion = { id: string; gelId: string };

export function canonicalRegionOrder(
  order: string[],
  regions: OrderedRegion[],
) {
  const known = new Set(regions.map((region) => region.id)),
    seen = new Set<string>(),
    canonical: string[] = [];
  order.forEach((id) => {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      canonical.push(id);
    }
  });
  regions.forEach((region) => {
    if (!seen.has(region.id)) {
      seen.add(region.id);
      canonical.push(region.id);
    }
  });
  return canonical;
}

function moveLocalOrder(
  order: string[],
  regions: OrderedRegion[],
  gelId: string,
  from: number,
  to: number,
) {
  const byId = new Map(regions.map((region) => [region.id, region])),
    localIds = order.filter((id) => byId.get(id)?.gelId === gelId);
  if (
    from < 0 ||
    to < 0 ||
    from >= localIds.length ||
    to >= localIds.length ||
    from === to
  )
    return order;
  const [moved] = localIds.splice(from, 1);
  localIds.splice(to, 0, moved);
  let localIndex = 0;
  return order.map((id) =>
    byId.get(id)?.gelId === gelId ? localIds[localIndex++] : id,
  );
}

export function reorderRegionWithinGel(
  order: string[],
  regions: OrderedRegion[],
  movedId: string,
  targetId: string,
  syncGelOrder: boolean,
  gelIds: string[],
) {
  const byId = new Map(regions.map((region) => [region.id, region])),
    moved = byId.get(movedId),
    target = byId.get(targetId),
    canonical = canonicalRegionOrder(order, regions);
  if (!moved || !target || moved.gelId !== target.gelId) return canonical;
  const localIds = canonical.filter((id) => byId.get(id)?.gelId === moved.gelId),
    from = localIds.indexOf(movedId),
    to = localIds.indexOf(targetId);
  let next = moveLocalOrder(canonical, regions, moved.gelId, from, to);
  if (syncGelOrder)
    gelIds
      .filter((gelId) => gelId !== moved.gelId)
      .forEach((gelId) => {
        next = moveLocalOrder(next, regions, gelId, from, to);
      });
  return next;
}
