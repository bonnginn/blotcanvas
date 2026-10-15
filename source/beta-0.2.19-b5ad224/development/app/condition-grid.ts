export type GridGroup = {
  label: string;
  start: number;
  span: number;
  showLine?: boolean;
};
export type GridRow = {
  id: string;
  name: string;
  values: string[];
  visible: boolean;
  lineBelow?: boolean;
  groups?: GridGroup[];
};
export type GridGel = { lanes: number; conditions: GridRow[] };
export type GridCellPosition = { rowIndex: number; start: number; span: number };

export const groupShowsSeparator = (
  row: Pick<GridRow, "lineBelow">,
  group: GridGroup,
) =>
  Boolean(
    row.lineBelow &&
      group.span > 1 &&
      group.showLine !== false &&
      group.label.trim(),
  );

const rowCells = (row: GridRow, lanes: number): GridGroup[] => {
  const groups = row.groups?.length
    ? [...row.groups]
    : Array.from({ length: lanes }, (_, start) => ({
        label: row.values[start] || "",
        start,
        span: 1,
      }));
  return groups
    .filter((cell) => cell.start < lanes && cell.span > 0)
    .map((cell) => ({
      ...cell,
      span: Math.min(cell.span, lanes - cell.start),
    }))
    .sort((a, b) => a.start - b.start);
};

export const nextGridCell = (
  gel: GridGel,
  current: GridCellPosition,
  key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Enter" | "Tab",
  shiftKey = false,
): GridCellPosition => {
  if (!gel.conditions.length || gel.lanes < 1) return current;
  const rowIndex = Math.max(
      0,
      Math.min(gel.conditions.length - 1, current.rowIndex),
    ),
    currentCells = rowCells(gel.conditions[rowIndex], gel.lanes),
    currentIndex = Math.max(
      0,
      currentCells.findIndex(
        (cell) =>
          current.start >= cell.start &&
          current.start < cell.start + cell.span,
      ),
    ),
    horizontalBack = key === "ArrowLeft" || (key === "Tab" && shiftKey),
    horizontalForward =
      key === "ArrowRight" || (key === "Tab" && !shiftKey);

  if (horizontalBack || horizontalForward) {
    const delta = horizontalBack ? -1 : 1,
      targetIndex = currentIndex + delta;
    if (targetIndex >= 0 && targetIndex < currentCells.length) {
      const cell = currentCells[targetIndex];
      return { rowIndex, start: cell.start, span: cell.span };
    }
    const targetRow = rowIndex + delta;
    if (targetRow < 0 || targetRow >= gel.conditions.length) {
      const cell = currentCells[currentIndex];
      return { rowIndex, start: cell.start, span: cell.span };
    }
    const targetCells = rowCells(gel.conditions[targetRow], gel.lanes),
      cell = horizontalBack
        ? targetCells[targetCells.length - 1]
        : targetCells[0];
    return cell
      ? { rowIndex: targetRow, start: cell.start, span: cell.span }
      : current;
  }

  const rowDelta = key === "ArrowUp" ? -1 : 1,
    targetRow = Math.max(
      0,
      Math.min(gel.conditions.length - 1, rowIndex + rowDelta),
    ),
    targetCells = rowCells(gel.conditions[targetRow], gel.lanes),
    targetLane = currentCells[currentIndex]?.start ?? current.start,
    cell =
      targetCells.find(
        (candidate) =>
          targetLane >= candidate.start &&
          targetLane < candidate.start + candidate.span,
      ) ||
      targetCells.reduce<GridGroup | undefined>((closest, candidate) =>
        !closest ||
        Math.abs(candidate.start - targetLane) <
          Math.abs(closest.start - targetLane)
          ? candidate
          : closest,
      undefined);
  return cell
    ? { rowIndex: targetRow, start: cell.start, span: cell.span }
    : current;
};

export const expandedRowValues = (row: GridRow, lanes: number) =>
  Array.from({ length: lanes }, (_, lane) => {
    const group = row.groups?.find(
      (item) => lane >= item.start && lane < item.start + item.span,
    );
    return group ? (lane === group.start ? group.label : "") : row.values[lane] || "";
  });

export const resizeLaneGrid = (gel: GridGel, lanes: number) => {
  const count = Math.max(0, Math.min(40, lanes));
  gel.lanes = count;
  gel.conditions.forEach((row) => {
    row.values = expandedRowValues(row, count);
    if (!row.groups?.length) return;
    row.groups = row.groups
      .filter((group) => group.start < count)
      .map((group) => ({
        ...group,
        span: Math.max(1, Math.min(group.span, count - group.start)),
      }));
    if (!row.groups.some((group) => group.span > 1)) row.groups = undefined;
  });
};

export const parseClipboardGrid = (text: string) =>
  text
    .replace(/\r/g, "")
    .split("\n")
    .filter((line, index, all) => line.length || index < all.length - 1)
    .map((line) => line.split("\t"));

export const pasteGrid = (
  gel: GridGel,
  rowStart: number,
  laneStart: number,
  pasted: string[][],
  createRow: (index: number, lanes: number) => GridRow,
) => {
  if (!pasted.length) return;
  const lanes = Math.min(
    40,
    Math.max(gel.lanes, laneStart + Math.max(...pasted.map((row) => row.length))),
  );
  resizeLaneGrid(gel, lanes);
  while (gel.conditions.length < rowStart + pasted.length)
    gel.conditions.push(createRow(gel.conditions.length, lanes));
  pasted.forEach((values, rowOffset) => {
    const row = gel.conditions[rowStart + rowOffset],
      end = laneStart + values.length,
      retainedGroups = (row.groups || []).filter(
        (group) => group.start + group.span <= laneStart || group.start >= end,
      );
    row.values = expandedRowValues(row, lanes);
    values.forEach((value, offset) => {
      if (laneStart + offset < lanes) row.values[laneStart + offset] = value;
    });
    row.groups = retainedGroups.some((group) => group.span > 1)
      ? retainedGroups
      : undefined;
  });
};

export const fillSeries = (seed: string[], length: number) => {
  if (!seed.length) return Array(length).fill("");
  const numbers = seed.map((value) => Number(value));
  if (seed.length === 1 && seed[0].trim() !== "" && Number.isFinite(numbers[0]))
    return Array.from({ length }, (_, index) => String(numbers[0] + index));
  if (seed.length >= 2 && numbers.every(Number.isFinite)) {
    const step = numbers[1] - numbers[0];
    if (numbers.every((value, index) => value === numbers[0] + step * index))
      return Array.from({ length }, (_, index) => String(numbers[0] + step * index));
  }
  if (seed.length === 1) {
    const suffix = seed[0].match(/^(.*?)(\d+)$/);
    if (suffix) {
      const width = suffix[2].length,
        start = Number(suffix[2]);
      return Array.from(
        { length },
        (_, index) => `${suffix[1]}${String(start + index).padStart(width, "0")}`,
      );
    }
  }
  return Array.from({ length }, (_, index) => seed[index % seed.length]);
};

export const fillRowToRight = (
  row: GridRow,
  lanes: number,
  start: number,
  end: number,
) => {
  row.values = expandedRowValues(row, lanes);
  row.groups = undefined;
  const seed = row.values.slice(start, end + 1),
    filled = fillSeries(seed, lanes - start);
  for (let lane = start; lane < lanes; lane++) row.values[lane] = filled[lane - start];
};
