<script lang="ts">
  type ChartPoint = {
    x: string;
    y: number | null | undefined;
  };

  type ChartSeries = {
    label: string;
    color: string;
    values: ChartPoint[];
  };

  type HoveredPoint = {
    seriesLabel: string;
    color: string;
    point: ChartPoint;
    x: number;
    y: number;
  };

  export let title = '';
  export let series: ChartSeries[] = [];
  export let height = 240;
  export let minY: number | null = null;
  export let maxY: number | null = null;
  export let yFormatter: (value: number) => string = (value) => value.toLocaleString();
  export let xFormatter: (value: string) => string = (value) => value;
  export let showLegend = true;

  const width = 760;
  const margin = { top: 18, right: 18, bottom: 34, left: 48 };
  const gridCount = 4;
  const tooltipWidth = 190;
  const tooltipHeight = 78;

  let hoveredPoint: HoveredPoint | null = null;

  $: allValues = series.flatMap((line) =>
    line.values
      .map((point) => point.y)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  );
  $: computedMin = minY ?? (allValues.length ? Math.min(...allValues) : 0);
  $: computedMax = maxY ?? (allValues.length ? Math.max(...allValues) : 1);
  $: ySpan = Math.max(computedMax - computedMin, 1);
  $: ticks = Array.from({ length: gridCount + 1 }, (_, index) => computedMin + (ySpan * index) / gridCount);
  $: firstSeries = series[0]?.values ?? [];
  $: xTicks = firstSeries.length
    ? [firstSeries[0], firstSeries[Math.floor(firstSeries.length / 2)], firstSeries[firstSeries.length - 1]]
    : [];

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

  function showPoint(line: ChartSeries, point: ChartPoint, index: number) {
    if (!isValidValue(point.y)) return;
    hoveredPoint = {
      seriesLabel: line.label,
      color: line.color,
      point,
      x: xAt(index, line.values.length),
      y: yAt(point.y)
    };
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
      {#each ticks as tick}
        <line class="grid" x1={margin.left} x2={width - margin.right} y1={yAt(tick)} y2={yAt(tick)} />
        <text class="axis-label" x={margin.left - 10} y={yAt(tick) + 4} text-anchor="end">
          {yFormatter(tick)}
        </text>
      {/each}

      {#each series as line}
        <path class="line" d={linePath(line.values)} stroke={line.color} />
      {/each}

      {#each series as line}
        {#each line.values as point, index}
          {#if isValidValue(point.y)}
            {@const pointX = xAt(index, line.values.length)}
            {@const pointY = yAt(point.y)}
            <circle
              class="point"
              class:active={hoveredPoint?.point === point && hoveredPoint?.seriesLabel === line.label}
              cx={pointX}
              cy={pointY}
              r="3.8"
              fill={line.color}
            />
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
              on:pointerleave={() => (hoveredPoint = null)}
            />
          {/if}
        {/each}
      {/each}

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

      {#if hoveredPoint && isValidValue(hoveredPoint.point.y)}
        <line
          class="hover-guide"
          x1={hoveredPoint.x}
          x2={hoveredPoint.x}
          y1={margin.top}
          y2={height - margin.bottom}
          stroke={hoveredPoint.color}
        />
        <circle class="hover-ring" cx={hoveredPoint.x} cy={hoveredPoint.y} r="7" stroke={hoveredPoint.color} />
        <g class="chart-tooltip" transform={`translate(${tooltipX(hoveredPoint.x)}, ${tooltipY(hoveredPoint.y)})`}>
          <rect class="tooltip-box" width={tooltipWidth} height={tooltipHeight} rx="8" fill="white" stroke={hoveredPoint.color} />
          <rect class="tooltip-accent" width="5" height={tooltipHeight} rx="2.5" fill={hoveredPoint.color} />
          <circle cx="18" cy="21" r="4.5" fill={hoveredPoint.color} />
          <text class="tooltip-title" x="30" y="24">{xFormatter(hoveredPoint.point.x)}</text>
          <text class="tooltip-value" x="14" y="49" fill={hoveredPoint.color}>
            {hoveredPoint.seriesLabel}: {yFormatter(hoveredPoint.point.y)}
          </text>
          <text class="tooltip-meta" x="14" y="67">{hoveredPoint.point.x}</text>
        </g>
      {/if}
    </svg>
  {:else}
    <div class="empty">No data available</div>
  {/if}

  {#if showLegend}
    <div class="legend">
      {#each series as line}
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
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .point {
    opacity: 0;
    transition:
      opacity 120ms ease,
      r 120ms ease;
    vector-effect: non-scaling-stroke;
  }

  .point.active {
    opacity: 1;
    r: 5;
  }

  .point-hit {
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
