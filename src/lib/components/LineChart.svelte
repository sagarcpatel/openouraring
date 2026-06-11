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

  type HoveredPoint = {
    seriesLabel: string;
    color: string;
    point: ChartPoint;
    x: number;
    y: number;
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
  export let hoverMode: 'point' | 'x' = 'point';
  export let backgroundBands: BackgroundBand[] = [];

  const width = 760;
  const margin = { top: 18, right: 18, bottom: 34, left: 48 };
  const gridCount = 4;
  const tooltipWidth = 230;

  let hoveredPoint: HoveredPoint | null = null;
  let hoveredIndex: number | null = null;

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
  $: tooltipEntries = entriesForHover();
  $: tooltipDay = hoverMode === 'x' && hoveredIndex !== null ? firstSeries[hoveredIndex]?.x : hoveredPoint?.point.x;
  $: hoveredX =
    hoverMode === 'x' && hoveredIndex !== null ? xAt(hoveredIndex, firstSeries.length) : hoveredPoint?.x ?? 0;
  $: hoveredY =
    hoverMode === 'x'
      ? Math.min(...tooltipEntries.map((entry) => entry.y).filter((value): value is number => value !== null), height / 2)
      : hoveredPoint?.y ?? height / 2;
  $: tooltipHeight = Math.max(78, 48 + tooltipEntries.length * 18);

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

  function tooltipX(x: number) {
    return Math.min(Math.max(x + 12, margin.left), width - margin.right - tooltipWidth);
  }

  function tooltipY(y: number) {
    return Math.min(Math.max(y - tooltipHeight - 12, margin.top), height - margin.bottom - tooltipHeight);
  }

  function pointOpacity(line: ChartSeries, point: ChartPoint) {
    const active = isPointActive(line, point);
    if (active) return 1;
    if (line.showPoints === 'always') return line.pointOpacity ?? line.opacity ?? 0.5;
    return 0;
  }

  function pointRadius(line: ChartSeries, point: ChartPoint) {
    const radius = line.pointRadius ?? 3.8;
    return isPointActive(line, point) ? radius + 1.3 : radius;
  }

  function isPointActive(line: ChartSeries, point: ChartPoint) {
    if (hoverMode === 'x' && hoveredIndex !== null) return line.values[hoveredIndex] === point;
    return hoveredPoint?.point === point && hoveredPoint?.seriesLabel === line.label;
  }

  function entriesForHover(): TooltipEntry[] {
    if (hoverMode === 'x') {
      if (hoveredIndex === null) return [];
      const index = hoveredIndex;
      return series
        .map((line) => {
          const point = line.values[index];
          if (!point || !isValidValue(point.y)) return null;
          return {
            label: line.label,
            color: line.color,
            value: point.y,
            y: line.tooltipOnly ? null : yAt(point.y)
          };
        })
        .filter((entry): entry is TooltipEntry => entry !== null);
    }

    if (!hoveredPoint || !isValidValue(hoveredPoint.point.y)) return [];
    return [
      {
        label: hoveredPoint.seriesLabel,
        color: hoveredPoint.color,
        value: hoveredPoint.point.y,
        y: hoveredPoint.y
      }
    ];
  }

  function bandY(from: number, to: number | null) {
    const bandFrom = Math.max(from, computedMin);
    const bandTo = Math.min(to ?? computedMax, computedMax);
    const y1 = yAt(bandTo);
    const y2 = yAt(bandFrom);
    return { y: y1, height: Math.max(y2 - y1, 0) };
  }

  function showPoint(line: ChartSeries, point: ChartPoint, index: number) {
    if (!isValidValue(point.y)) return;
    hoveredIndex = index;
    hoveredPoint = {
      seriesLabel: line.label,
      color: line.color,
      point,
      x: xAt(index, line.values.length),
      y: yAt(point.y)
    };
  }

  function showDay(index: number) {
    hoveredIndex = index;
    hoveredPoint = null;
  }

  function clearHover() {
    hoveredIndex = null;
    hoveredPoint = null;
  }
</script>

<section class="chart-panel">
  {#if title}
    <div class="chart-heading">{title}</div>
  {/if}

  {#if allValues.length}
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
            <circle
              class="point"
              class:active={isPointActive(line, point)}
              cx={pointX}
              cy={pointY}
              r={pointRadius(line, point)}
              fill={line.color}
              style={`opacity: ${pointOpacity(line, point)}`}
            />
            {#if hoverMode === 'point'}
              <circle
                class="point-hit"
                role="graphics-symbol"
                aria-label={`${line.label} on ${xFormatter(point.x)}: ${yFormatter(point.y)}`}
                cx={pointX}
                cy={pointY}
                r="10"
                fill="transparent"
                on:pointerenter={() => showPoint(line, point, index)}
                on:pointermove={() => showPoint(line, point, index)}
                on:pointerleave={clearHover}
              />
            {/if}
          {/if}
        {/each}
      {/each}

      {#if hoverMode === 'x'}
        {#each firstSeries as point, index}
          {@const hitLeft = index === 0 ? margin.left : (xAt(index - 1, firstSeries.length) + xAt(index, firstSeries.length)) / 2}
          {@const hitRight =
            index === firstSeries.length - 1
              ? width - margin.right
              : (xAt(index, firstSeries.length) + xAt(index + 1, firstSeries.length)) / 2}
          <rect
            class="day-hit"
            role="graphics-symbol"
            aria-label={`${xFormatter(point.x)} chart values`}
            x={hitLeft}
            y={margin.top}
            width={Math.max(hitRight - hitLeft, 1)}
            height={height - margin.top - margin.bottom}
            fill="transparent"
            on:pointerenter={() => showDay(index)}
            on:pointermove={() => showDay(index)}
            on:pointerleave={clearHover}
          />
        {/each}
      {/if}

      {#each xTicks as tick, index}
        {#if tick}
          <text
            class="axis-label x-label"
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
        <g class="chart-tooltip" transform={`translate(${tooltipX(hoveredX)}, ${tooltipY(hoveredY)})`}>
          <rect class="tooltip-box" width={tooltipWidth} height={tooltipHeight} rx="8" fill="white" stroke={tooltipEntries[0].color} />
          <rect class="tooltip-accent" width="5" height={tooltipHeight} rx="2.5" fill={tooltipEntries[0].color} />
          <text class="tooltip-title" x="14" y="24">{xFormatter(tooltipDay)}</text>
          {#each tooltipEntries as entry, index}
            <circle cx="18" cy={49 + index * 18} r="4.5" fill={entry.color} />
            <text class="tooltip-value" x="30" y={53 + index * 18} fill={entry.color}>
              {entry.label}: {yFormatter(entry.value)}
            </text>
          {/each}
          <text class="tooltip-meta" x="14" y={tooltipHeight - 10}>{tooltipDay}</text>
        </g>
      {/if}
    </svg>
  {:else}
    <div class="empty">No data available</div>
  {/if}

  {#if showLegend}
    <div class="legend">
      {#each legendSeries as line}
        <span><i style={`background: ${line.color}`}></i>{line.label}</span>
      {/each}
    </div>
  {/if}
</section>

<style>
  .chart-panel {
    min-width: 0;
  }

  .chart-heading {
    color: #2c313a;
    font-size: 0.92rem;
    font-weight: 760;
    margin-bottom: 10px;
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

  .point-hit,
  .day-hit {
    cursor: crosshair;
    pointer-events: all;
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

  .chart-tooltip {
    filter: drop-shadow(0 12px 18px rgb(15 23 42 / 0.16));
    pointer-events: none;
  }

  .tooltip-box {
    stroke-width: 1.4;
    vector-effect: non-scaling-stroke;
  }

  .tooltip-title {
    fill: #2c313a;
    font-size: 13px;
    font-weight: 760;
  }

  .tooltip-value {
    font-size: 13px;
    font-weight: 760;
  }

  .tooltip-meta {
    fill: #667085;
    font-size: 11px;
    font-weight: 620;
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
