<script lang="ts">
  type StatePoint = {
    x: string;
    state: string | null | undefined;
  };

  type StateStyle = {
    label: string;
    color: string;
  };

  type HoveredPoint = {
    point: StatePoint;
    x: number;
  };

  export let title = '';
  export let points: StatePoint[] = [];
  export let styles: Record<string, StateStyle> = {};
  export let height = 108;
  export let maxPoints = 120;
  export let xFormatter: (value: string) => string = (value) => value;

  const width = 760;
  const margin = { top: 14, right: 14, bottom: 32, left: 38 };
  const tooltipWidth = 190;
  const tooltipHeight = 64;

  let hoveredPoint: HoveredPoint | null = null;

  $: visiblePoints = points.slice(-maxPoints);
  $: stateCounts = visiblePoints.reduce<Record<string, number>>((counts, point) => {
    if (point.state) {
      counts[point.state] = (counts[point.state] ?? 0) + 1;
    }
    return counts;
  }, {});

  function xAt(index: number) {
    return margin.left + (index / Math.max(visiblePoints.length, 1)) * (width - margin.left - margin.right);
  }

  function cellWidth() {
    return Math.max((width - margin.left - margin.right) / Math.max(visiblePoints.length, 1) - 2, 2);
  }

  function styleFor(state: string | null | undefined) {
    return state ? styles[state] : null;
  }

  function labelFor(state: string | null | undefined) {
    return styleFor(state)?.label ?? 'No summary';
  }

  function colorFor(state: string | null | undefined) {
    return styleFor(state)?.color ?? '#cbd5e1';
  }

  function tooltipX(x: number) {
    return Math.min(Math.max(x + 12, margin.left), width - margin.right - tooltipWidth);
  }
</script>

<section class="state-panel">
  {#if title}
    <div class="state-heading">{title}</div>
  {/if}

  {#if visiblePoints.length}
    <svg
      class="state-heatmap"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={title || 'Daily state heatmap'}
      style={`height: ${height}px`}
      preserveAspectRatio="none"
    >
      {#each visiblePoints as point, index}
        {@const cellX = xAt(index)}
        {@const widthValue = cellWidth()}
        <rect
          class="cell"
          class:active={hoveredPoint?.point === point}
          role="graphics-symbol"
          aria-label={`${xFormatter(point.x)}: ${labelFor(point.state)}`}
          x={cellX}
          y={margin.top}
          width={widthValue}
          height={height - margin.top - margin.bottom}
          rx="2"
          fill={colorFor(point.state)}
          on:pointerenter={() => (hoveredPoint = { point, x: cellX + widthValue / 2 })}
          on:pointermove={() => (hoveredPoint = { point, x: cellX + widthValue / 2 })}
          on:pointerleave={() => (hoveredPoint = null)}
        />
      {/each}
      <text class="axis-label" x={margin.left} y={height - 10} text-anchor="start">
        {xFormatter(visiblePoints[0].x)}
      </text>
      <text class="axis-label" x={width - margin.right} y={height - 10} text-anchor="end">
        {xFormatter(visiblePoints[visiblePoints.length - 1].x)}
      </text>

      {#if hoveredPoint}
        <g class="tooltip" transform={`translate(${tooltipX(hoveredPoint.x)}, ${margin.top})`}>
          <rect class="tooltip-box" width={tooltipWidth} height={tooltipHeight} rx="8" fill="white" stroke={colorFor(hoveredPoint.point.state)} />
          <rect class="tooltip-accent" width="5" height={tooltipHeight} rx="2.5" fill={colorFor(hoveredPoint.point.state)} />
          <text class="tooltip-title" x="14" y="24">{xFormatter(hoveredPoint.point.x)}</text>
          <text class="tooltip-value" x="14" y="48" fill={colorFor(hoveredPoint.point.state)}>
            {labelFor(hoveredPoint.point.state)}
          </text>
        </g>
      {/if}
    </svg>
    <div class="legend">
      {#each Object.entries(styles) as [state, style]}
        <span><i style={`background:${style.color}`}></i>{style.label} <strong>{stateCounts[state] ?? 0}</strong></span>
      {/each}
    </div>
  {:else}
    <div class="empty">No daily stress summaries</div>
  {/if}
</section>

<style>
  .state-panel {
    min-width: 0;
  }

  .state-heading {
    color: #2c313a;
    font-size: 0.92rem;
    font-weight: 760;
    margin-bottom: 10px;
  }

  .state-heatmap {
    display: block;
    min-height: 96px;
    width: 100%;
  }

  .cell {
    cursor: crosshair;
    opacity: 0.78;
    transition:
      opacity 120ms ease,
      filter 120ms ease;
  }

  .cell.active {
    filter: saturate(1.16);
    opacity: 1;
  }

  .axis-label {
    fill: #667085;
    font-size: 12px;
    font-weight: 620;
  }

  .tooltip {
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

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    margin-top: 10px;
  }

  .legend span {
    align-items: center;
    color: #566173;
    display: inline-flex;
    font-size: 0.78rem;
    font-weight: 680;
    gap: 6px;
  }

  .legend i {
    border-radius: 999px;
    display: inline-block;
    height: 9px;
    width: 9px;
  }

  .empty {
    align-items: center;
    border: 1px dashed #cbd3df;
    border-radius: 8px;
    color: #687386;
    display: flex;
    height: 108px;
    justify-content: center;
  }
</style>
