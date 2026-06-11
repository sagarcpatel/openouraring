<script lang="ts">
  type StackPart = {
    label: string;
    value: number | null | undefined;
    color: string;
  };

  type StackRow = {
    x: string;
    parts: StackPart[];
  };

  type HoveredSegment = {
    row: StackRow;
    part: StackPart;
    total: number;
    x: number;
    y: number;
  };

  export let title = '';
  export let rows: StackRow[] = [];
  export let height = 220;
  export let maxRows = 72;
  export let unit = 'h';
  export let xFormatter: (value: string) => string = (value) => value;
  export let valueFormatter: (value: number) => string = (value) => `${value.toFixed(1)}${unit}`;

  const width = 760;
  const margin = { top: 16, right: 14, bottom: 34, left: 38 };
  const tooltipWidth = 188;
  const tooltipHeight = 82;

  let hoveredSegment: HoveredSegment | null = null;

  $: visibleRows = rows.slice(-maxRows);
  $: maxTotal = Math.max(
    ...visibleRows.map((row) =>
      row.parts.reduce((sum, part) => sum + (typeof part.value === 'number' ? part.value : 0), 0)
    ),
    1
  );

  function xAt(index: number) {
    return margin.left + (index / Math.max(visibleRows.length, 1)) * (width - margin.left - margin.right);
  }

  function barWidth() {
    return Math.max((width - margin.left - margin.right) / Math.max(visibleRows.length, 1) - 3, 1);
  }

  function segmentHeight(value: number | null | undefined) {
    return ((typeof value === 'number' ? value : 0) / maxTotal) * (height - margin.top - margin.bottom);
  }

  function yBase(offset: number) {
    return height - margin.bottom - offset;
  }

  function numericValue(value: number | null | undefined) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  function rowTotal(row: StackRow) {
    return row.parts.reduce((sum, part) => sum + numericValue(part.value), 0);
  }

  function tooltipX(x: number) {
    return Math.min(Math.max(x + 12, margin.left), width - margin.right - tooltipWidth);
  }

  function tooltipY(y: number) {
    return Math.min(Math.max(y - tooltipHeight - 12, margin.top), height - margin.bottom - tooltipHeight);
  }
</script>

<section class="stacked-panel">
  {#if title}
    <div class="stacked-heading">{title}</div>
  {/if}

  {#if visibleRows.length}
    <svg
      class="stacked-bars"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={title || 'Stacked bar chart'}
      style={`height: ${height}px`}
      preserveAspectRatio="none"
    >
      {#each visibleRows as row, index}
        {@const parts = row.parts}
        {@const barX = xAt(index)}
        {@const widthValue = barWidth()}
        {@const total = rowTotal(row)}
        {#each parts as part, partIndex}
          {@const prior = parts.slice(0, partIndex).reduce((sum, item) => sum + segmentHeight(item.value), 0)}
          {@const h = segmentHeight(part.value)}
          <rect
            class="segment"
            class:active={hoveredSegment?.row === row && hoveredSegment?.part === part}
            role="graphics-symbol"
            aria-label={`${part.label} on ${xFormatter(row.x)}: ${valueFormatter(numericValue(part.value))}`}
            x={barX}
            y={yBase(prior + h)}
            width={widthValue}
            height={h}
            rx="1.5"
            fill={part.color}
            on:pointerenter={() =>
              (hoveredSegment = {
                row,
                part,
                total,
                x: barX + widthValue / 2,
                y: yBase(prior + h)
              })}
            on:pointermove={() =>
              (hoveredSegment = {
                row,
                part,
                total,
                x: barX + widthValue / 2,
                y: yBase(prior + h)
              })}
            on:pointerleave={() => (hoveredSegment = null)}
          />
        {/each}
      {/each}
      <text class="axis-label" x={margin.left} y={height - 10} text-anchor="start">
        {xFormatter(visibleRows[0].x)}
      </text>
      <text class="axis-label" x={width - margin.right} y={height - 10} text-anchor="end">
        {xFormatter(visibleRows[visibleRows.length - 1].x)}
      </text>
      <text class="axis-label" x={margin.left - 6} y={margin.top + 8} text-anchor="end">
        {maxTotal.toFixed(1)}{unit}
      </text>

      {#if hoveredSegment}
        <g class="bar-tooltip" transform={`translate(${tooltipX(hoveredSegment.x)}, ${tooltipY(hoveredSegment.y)})`}>
          <rect class="tooltip-box" width={tooltipWidth} height={tooltipHeight} rx="8" fill="white" stroke={hoveredSegment.part.color} />
          <rect class="tooltip-accent" width="5" height={tooltipHeight} rx="2.5" fill={hoveredSegment.part.color} />
          <circle cx="18" cy="21" r="4.5" fill={hoveredSegment.part.color} />
          <text class="tooltip-title" x="30" y="24">{xFormatter(hoveredSegment.row.x)}</text>
          <text class="tooltip-value" x="14" y="49" fill={hoveredSegment.part.color}>
            {hoveredSegment.part.label}: {valueFormatter(numericValue(hoveredSegment.part.value))}
          </text>
          <text class="tooltip-meta" x="14" y="68">
            Total: {valueFormatter(hoveredSegment.total)} | {hoveredSegment.row.x}
          </text>
        </g>
      {/if}
    </svg>
    <div class="legend">
      {#each visibleRows[0].parts as part}
        <span><i style={`background:${part.color}`}></i>{part.label}</span>
      {/each}
    </div>
  {:else}
    <div class="empty">No stacked data</div>
  {/if}
</section>

<style>
  .stacked-panel {
    min-width: 0;
  }

  .stacked-heading {
    color: #2c313a;
    font-size: 0.92rem;
    font-weight: 760;
    margin-bottom: 10px;
  }

  .stacked-bars {
    display: block;
    height: var(--stacked-height, 220px);
    min-height: 170px;
    width: 100%;
  }

  .axis-label {
    fill: #667085;
    font-size: 12px;
    font-weight: 620;
  }

  .segment {
    cursor: crosshair;
    opacity: 0.86;
    transition:
      opacity 120ms ease,
      filter 120ms ease;
  }

  .segment.active {
    filter: saturate(1.18);
    opacity: 1;
  }

  .bar-tooltip {
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
    height: 170px;
    justify-content: center;
  }
</style>
