<script lang="ts">
  type ChartPoint = {
    x: string;
    y: number | null | undefined;
  };

  type ChartSeries = {
    label: string;
    color: string;
    values: ChartPoint[];
    opacity?: number;
    pointOpacity?: number;
    pointRadius?: number;
    showInLegend?: boolean;
    showPoints?: 'always' | 'hover' | false;
    strokeWidth?: number;
    tooltipOnly?: boolean;
  };

  type BackgroundBand = {
    from: number;
    to: number | null;
    color: string;
  };

  type TooltipEntry = {
    label: string;
    color: string;
    value: number;
    y: number | null;
  };

  export let title = '';
  export let series: ChartSeries[] = [];
  export let height = 240;
  export let minY: number | null = null;
  export let maxY: number | null = null;
  export let tickInterval: number | null = null;
  export let yFormatter: (value: number) => string = (value) => value.toLocaleString();
  export let xFormatter: (value: string) => string = (value) => value;
  export let showLegend = true;
  export let backgroundBands: BackgroundBand[] = [];

  const width = 760;
  const margin = { top: 18, right: 18, bottom: 34, left: 48 };
  const gridCount = 4;
  const axisBadgeWidth = 122;
  const axisBadgeHeight = 22;

  let hoveredIndex: number | null = null;
  let hoverPinned = false;
  let hitOverlay: HTMLDivElement;

  $: drawableSeries = series.filter((line) => !line.tooltipOnly);
  $: legendSeries = series.filter((line) => line.showInLegend !== false && !line.tooltipOnly);
  $: allValues = drawableSeries.flatMap((line) =>
    line.values
      .map((point) => point.y)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  );
  $: rawMin = minY ?? (allValues.length ? Math.min(...allValues) : 0);
  $: rawMax = maxY ?? (allValues.length ? Math.max(...allValues) : 1);
  $: computedMin = tickInterval && minY === null ? Math.floor(rawMin / tickInterval) * tickInterval : rawMin;
  $: computedMax = tickInterval && maxY === null ? Math.ceil(rawMax / tickInterval) * tickInterval : rawMax;
  $: ySpan = Math.max(computedMax - computedMin, 1);
  $: ticks = tickInterval
    ? fixedTicks(computedMin, computedMax, tickInterval)
    : Array.from({ length: gridCount + 1 }, (_, index) => computedMin + (ySpan * index) / gridCount);
  $: firstSeries = series[0]?.values ?? [];
  $: xTicks = firstSeries.length
    ? [firstSeries[0], firstSeries[Math.floor(firstSeries.length / 2)], firstSeries[firstSeries.length - 1]]
    : [];
  $: tooltipEntries = entriesForHover(hoveredIndex, series, computedMin, ySpan);
  $: tooltipDay = hoveredIndex !== null ? firstSeries[hoveredIndex]?.x : null;
  $: tooltipTitle = tooltipDay ? formatFullDay(tooltipDay) : '';
  $: hoveredX = hoveredIndex !== null ? xAt(hoveredIndex, firstSeries.length) : 0;
  $: axisBadgeX = Math.min(
    Math.max(hoveredX - axisBadgeWidth / 2, margin.left),
    width - margin.right - axisBadgeWidth
  );
  $: axisBadgePointerX = Math.max(Math.min(hoveredX - axisBadgeX, axisBadgeWidth - 10), 10);

  function xAt(index: number, length: number) {
    if (length <= 1) return margin.left;
    return margin.left + (index / (length - 1)) * (width - margin.left - margin.right);
  }

  function yAt(value: number) {
    return height - margin.bottom - ((value - computedMin) / ySpan) * (height - margin.top - margin.bottom);
  }

  function isValidValue(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function fixedTicks(min: number, max: number, interval: number) {
    if (interval <= 0) return [min, max];
    const ticks: number[] = [];
    const start = Math.ceil(min / interval) * interval;
    const end = Math.floor(max / interval) * interval;
    for (let value = start; value <= end + interval / 1000; value += interval) {
      ticks.push(Number(value.toFixed(6)));
    }
    if (!ticks.length || ticks[0] > min) ticks.unshift(min);
    if (ticks[ticks.length - 1] < max) ticks.push(max);
    return [...new Set(ticks)];
  }

  function linePath(values: ChartPoint[]) {
    return values
      .map((point, index) => ({ point, index }))
      .filter(({ point }) => isValidValue(point.y))
      .map(({ point, index }, pathIndex) => {
        const command = pathIndex === 0 ? 'M' : 'L';
        return `${command}${xAt(index, values.length).toFixed(2)},${yAt(point.y as number).toFixed(2)}`;
      })
      .join(' ');
  }

  function pointOpacity(line: ChartSeries, active: boolean) {
    if (active) return 1;
    if (line.showPoints === 'always') return line.pointOpacity ?? line.opacity ?? 0.5;
    return 0;
  }

  function pointRadius(line: ChartSeries, active: boolean) {
    const radius = line.pointRadius ?? 3.8;
    return active ? radius + 1.3 : radius;
  }

  function entriesForHover(index: number | null, lines: ChartSeries[], currentMin: number, currentSpan: number): TooltipEntry[] {
    if (index === null) return [];
    return lines
      .map((line) => {
        const point = line.values[index];
        if (!point || !isValidValue(point.y)) return null;
        return {
          label: line.label,
          color: line.color,
          value: point.y,
          y: line.tooltipOnly
            ? null
            : height - margin.bottom - ((point.y - currentMin) / currentSpan) * (height - margin.top - margin.bottom)
        };
      })
      .filter((entry): entry is TooltipEntry => entry !== null);
  }

  function formatFullDay(value: string) {
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return xFormatter(value);
    const weekday = date.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' });
    return `${weekday} ${xFormatter(value)} ${date.getUTCFullYear()}`;
  }

  function bandY(from: number, to: number | null) {
    const bandFrom = Math.max(from, computedMin);
    const bandTo = Math.min(to ?? computedMax, computedMax);
    const y1 = yAt(bandTo);
    const y2 = yAt(bandFrom);
    return { y: y1, height: Math.max(y2 - y1, 0) };
  }

  function showDay(index: number, pinned = false) {
    hoveredIndex = index;
    hoverPinned = pinned;
  }

  function indexFromClientX(clientX: number, target: HTMLElement) {
    if (!firstSeries.length) return null;
    const rect = target.getBoundingClientRect();
    if (!rect.width) return null;
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    return Math.min(Math.max(Math.round(ratio * (firstSeries.length - 1)), 0), firstSeries.length - 1);
  }

  function showDayFromClientX(clientX: number, target: HTMLElement, pinned = false) {
    const index = indexFromClientX(clientX, target);
    if (index !== null) showDay(index, pinned || hoverPinned);
  }

  function isInsidePlot(clientX: number, clientY: number) {
    if (!hitOverlay) return false;
    const rect = hitOverlay.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  function handleWindowMove(event: MouseEvent) {
    if (!hitOverlay) return;
    if (isInsidePlot(event.clientX, event.clientY)) {
      showDayFromClientX(event.clientX, hitOverlay);
    } else if (!hoverPinned) {
      hoveredIndex = null;
    }
  }

  function handleWindowClick(event: MouseEvent) {
    if (!hitOverlay || !isInsidePlot(event.clientX, event.clientY)) return;
    showDayFromClientX(event.clientX, hitOverlay, true);
  }

  function handleWindowTouch(event: TouchEvent) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    if (!touch || !hitOverlay || !isInsidePlot(touch.clientX, touch.clientY)) return;
    showDayFromClientX(touch.clientX, hitOverlay, true);
  }

  function handleOverlayKey(event: KeyboardEvent) {
    if (!firstSeries.length) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      showDay(Math.max((hoveredIndex ?? 0) - 1, 0), true);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      showDay(Math.min((hoveredIndex ?? 0) + 1, firstSeries.length - 1), true);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showDay(hoveredIndex ?? Math.floor(firstSeries.length / 2), true);
    }
  }

  function focusOverlay() {
    if (hoveredIndex === null && firstSeries.length) {
      showDay(Math.floor(firstSeries.length / 2), true);
    }
  }

  function clearHover(event: PointerEvent | MouseEvent) {
    if ('pointerType' in event && event.pointerType === 'touch') return;
    if (hoverPinned) return;
    hoveredIndex = null;
  }

  function legendValue(line: ChartSeries, index: number | null) {
    if (index === null) return null;
    const value = line.values[index]?.y;
    return isValidValue(value) ? yFormatter(value) : null;
  }
</script>

<svelte:window onmousemove={handleWindowMove} onclick={handleWindowClick} ontouchstart={handleWindowTouch} />

<section class="chart-panel">
  {#if title}
    <div class="chart-heading">
      <span class="heading-title">{title}</span>
    </div>
  {/if}

  {#if allValues.length}
    <div class="chart-frame" style={`--chart-height: ${height}px; --plot-left: ${(margin.left / width) * 100}%; --plot-right: ${(margin.right / width) * 100}%; --plot-top: ${margin.top}px; --plot-bottom: ${margin.bottom}px;`}>
      <svg
        class="line-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={title || 'Line chart'}
        style={`height: ${height}px`}
        preserveAspectRatio="none"
      >
      {#each backgroundBands as band}
        {#if (band.to ?? computedMax) > computedMin && band.from < computedMax}
          {@const range = bandY(band.from, band.to)}
          <rect
            class="background-band"
            x={margin.left}
            y={range.y}
            width={width - margin.left - margin.right}
            height={range.height}
            fill={band.color}
          />
        {/if}
      {/each}

      {#each ticks as tick}
        <line class="grid" x1={margin.left} x2={width - margin.right} y1={yAt(tick)} y2={yAt(tick)} />
        <text class="axis-label" x={margin.left - 10} y={yAt(tick) + 4} text-anchor="end">
          {yFormatter(tick)}
        </text>
      {/each}

      {#each drawableSeries as line}
        <path
          class="line"
          d={linePath(line.values)}
          stroke={line.color}
          stroke-width={line.strokeWidth ?? 3}
          opacity={line.opacity ?? 1}
        />
      {/each}

      {#each drawableSeries as line}
        {#each line.values as point, index}
          {#if isValidValue(point.y)}
            {@const pointX = xAt(index, line.values.length)}
            {@const pointY = yAt(point.y)}
            {@const isActive = hoveredIndex !== null && line.values[hoveredIndex] === point}
            <circle
              class="point"
              class:active={isActive}
              cx={pointX}
              cy={pointY}
              r={pointRadius(line, isActive)}
              fill={line.color}
              style={`opacity: ${pointOpacity(line, isActive)}`}
            />
          {/if}
        {/each}
      {/each}

      {#each xTicks as tick, index}
        {#if tick}
          <text
            class="axis-label x-label"
            class:hover-muted={!!tooltipDay}
            x={xAt(index === 0 ? 0 : index === 1 ? Math.floor(firstSeries.length / 2) : firstSeries.length - 1, firstSeries.length)}
            y={height - 10}
            text-anchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'}
          >
            {xFormatter(tick.x)}
          </text>
        {/if}
      {/each}

      {#if tooltipEntries.length && tooltipDay}
        <line
          class="hover-guide"
          x1={hoveredX}
          x2={hoveredX}
          y1={margin.top}
          y2={height - margin.bottom}
          stroke={tooltipEntries[0].color}
        />
        {#each tooltipEntries as entry}
          {#if entry.y !== null}
            <circle class="hover-ring" cx={hoveredX} cy={entry.y} r="7" stroke={entry.color} />
          {/if}
        {/each}
        <g class="axis-date-marker" transform={`translate(${axisBadgeX}, ${height - margin.bottom + 8})`}>
          <path
            d={`M${axisBadgePointerX - 5} 0 L${axisBadgePointerX} -5 L${axisBadgePointerX + 5} 0 Z`}
            fill={tooltipEntries[0].color}
          />
          <rect width={axisBadgeWidth} height={axisBadgeHeight} rx="6" fill="white" stroke={tooltipEntries[0].color} />
          <text x={axisBadgeWidth / 2} y="15" text-anchor="middle">{tooltipTitle}</text>
        </g>
      {/if}
      </svg>

      <div
        bind:this={hitOverlay}
        class="hit-overlay"
        role="button"
        tabindex="0"
        aria-label={`${title || 'Line chart'} date selector`}
        on:focus={focusOverlay}
        on:keydown={handleOverlayKey}
        on:mouseleave={clearHover}
        on:pointerleave={clearHover}
      ></div>
    </div>
  {:else}
    <div class="empty">No data available</div>
  {/if}

  {#if showLegend}
    <div class="legend">
      {#each legendSeries as line}
        {@const value = legendValue(line, hoveredIndex)}
        <span>
          <i style={`background: ${line.color}`}></i>
          <span class="legend-label">{line.label}</span>
          {#if value}
            <strong class="legend-value" style={`color: ${line.color}`}>{value}</strong>
          {/if}
        </span>
      {/each}
    </div>
  {/if}
</section>

<style>
  .chart-panel {
    min-width: 0;
  }

  .chart-heading {
    align-items: center;
    color: #2c313a;
    display: flex;
    flex-wrap: nowrap;
    font-size: 0.92rem;
    font-weight: 760;
    gap: 6px 12px;
    margin-bottom: 10px;
    min-height: 1.35rem;
    overflow: hidden;
  }

  .heading-title {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chart-frame {
    min-height: 190px;
    position: relative;
  }

  .line-chart {
    display: block;
    width: 100%;
    height: var(--line-chart-height, 240px);
    min-height: 190px;
    overflow: visible;
  }

  .grid {
    stroke: #e2e6ed;
    stroke-width: 1;
  }

  .background-band {
    opacity: 0.56;
  }

  .axis-label {
    fill: #667085;
    font-size: 12px;
    font-weight: 620;
  }

  .x-label {
    fill: #48515f;
  }

  .x-label.hover-muted {
    opacity: 0.2;
  }

  .line {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .point {
    transition:
      opacity 120ms ease,
      r 120ms ease;
    vector-effect: non-scaling-stroke;
  }

  .hit-overlay {
    bottom: var(--plot-bottom);
    background: rgb(255 255 255 / 0.001);
    cursor: crosshair;
    left: var(--plot-left);
    position: absolute;
    right: var(--plot-right);
    top: var(--plot-top);
    touch-action: manipulation;
    z-index: 2;
  }

  .hit-overlay:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: -2px;
  }

  .hover-guide {
    opacity: 0.24;
    stroke-dasharray: 4 5;
    stroke-width: 1.2;
    vector-effect: non-scaling-stroke;
  }

  .hover-ring {
    fill: #ffffff;
    stroke-width: 2.5;
    vector-effect: non-scaling-stroke;
  }

  .axis-date-marker {
    filter: drop-shadow(0 4px 8px rgb(15 23 42 / 0.12));
    pointer-events: none;
  }

  .axis-date-marker rect {
    stroke-width: 1.3;
    vector-effect: non-scaling-stroke;
  }

  .axis-date-marker text {
    fill: #1f2937;
    font-size: 11px;
    font-weight: 820;
    letter-spacing: 0;
  }

  .legend {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    margin-top: 8px;
  }

  .legend span {
    align-items: center;
    color: #596171;
    display: inline-flex;
    font-size: 0.82rem;
    font-weight: 650;
    gap: 6px;
  }

  .legend-label {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .legend-value {
    font-weight: 840;
    white-space: nowrap;
  }

  .legend i {
    border-radius: 999px;
    display: inline-block;
    height: 8px;
    width: 18px;
  }

  .empty {
    align-items: center;
    border: 1px dashed #cbd3df;
    border-radius: 8px;
    color: #687386;
    display: flex;
    height: 190px;
    justify-content: center;
  }
</style>
