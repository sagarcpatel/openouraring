<script lang="ts">
  import type { HistogramBin } from '$lib/oura/types';

  type HoveredBin = {
    bin: HistogramBin;
    x: number;
    y: number;
  };

  export let title = '';
  export let bins: HistogramBin[] = [];
  export let color = '#2563eb';
  export let unit = '';
  export let height = 210;

  const width = 720;
  const margin = { top: 16, right: 14, bottom: 36, left: 38 };
  const tooltipWidth = 188;
  const tooltipHeight = 72;

  let hoveredBin: HoveredBin | null = null;

  $: maxCount = Math.max(...bins.map((bin) => bin.count), 1);

  function xAt(index: number) {
    return margin.left + (index / bins.length) * (width - margin.left - margin.right);
  }

  function barWidth() {
    return Math.max((width - margin.left - margin.right) / Math.max(bins.length, 1) - 3, 1);
  }

  function yAt(count: number) {
    return height - margin.bottom - (count / maxCount) * (height - margin.top - margin.bottom);
  }

  function tooltipX(x: number) {
    return Math.min(Math.max(x + 12, margin.left), width - margin.right - tooltipWidth);
  }

  function tooltipY(y: number) {
    return Math.min(Math.max(y - tooltipHeight - 12, margin.top), height - margin.bottom - tooltipHeight);
  }

  function formatBinValue(value: number) {
    return `${value.toLocaleString()}${unit}`;
  }
</script>

<section class="histogram-panel">
  {#if title}
    <div class="histogram-heading">{title}</div>
  {/if}

  {#if bins.length}
    <svg
      class="histogram"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={title || 'Histogram'}
      style={`height: ${height}px`}
      preserveAspectRatio="none"
    >
      {#each bins as bin, index}
        {@const barX = xAt(index)}
        {@const barY = yAt(bin.count)}
        {@const widthValue = barWidth()}
        <rect
          class="bar"
          class:active={hoveredBin?.bin === bin}
          role="graphics-symbol"
          aria-label={`${formatBinValue(bin.x0)} to ${formatBinValue(bin.x1)}: ${bin.count.toLocaleString()}`}
          x={barX}
          y={barY}
          width={widthValue}
          height={height - margin.bottom - barY}
          rx="2"
          fill={color}
          on:pointerenter={() => (hoveredBin = { bin, x: barX + widthValue / 2, y: barY })}
          on:pointermove={() => (hoveredBin = { bin, x: barX + widthValue / 2, y: barY })}
          on:pointerleave={() => (hoveredBin = null)}
        />
      {/each}
      <text class="axis-label" x={margin.left} y={height - 10} text-anchor="start">
        {bins[0].x0}{unit}
      </text>
      <text class="axis-label" x={width - margin.right} y={height - 10} text-anchor="end">
        {bins[bins.length - 1].x1}{unit}
      </text>
      <text class="axis-label" x={margin.left - 6} y={margin.top + 6} text-anchor="end">
        {maxCount.toLocaleString()}
      </text>

      {#if hoveredBin}
        <g class="histogram-tooltip" transform={`translate(${tooltipX(hoveredBin.x)}, ${tooltipY(hoveredBin.y)})`}>
          <rect class="tooltip-box" width={tooltipWidth} height={tooltipHeight} rx="8" fill="white" stroke={color} />
          <rect class="tooltip-accent" width="5" height={tooltipHeight} rx="2.5" fill={color} />
          <circle cx="18" cy="21" r="4.5" fill={color} />
          <text class="tooltip-title" x="30" y="24">
            {formatBinValue(hoveredBin.bin.x0)} to {formatBinValue(hoveredBin.bin.x1)}
          </text>
          <text class="tooltip-value" x="14" y="50" fill={color}>
            Count: {hoveredBin.bin.count.toLocaleString()}
          </text>
        </g>
      {/if}
    </svg>
  {:else}
    <div class="empty">No distribution data</div>
  {/if}
</section>

<style>
  .histogram-panel {
    min-width: 0;
  }

  .histogram-heading {
    color: #2c313a;
    font-size: 0.92rem;
    font-weight: 760;
    margin-bottom: 10px;
  }

  .histogram {
    display: block;
    height: var(--histogram-height, 210px);
    min-height: 170px;
    width: 100%;
  }

  .axis-label {
    fill: #667085;
    font-size: 12px;
    font-weight: 620;
  }

  .bar {
    cursor: crosshair;
    opacity: 0.82;
    transition:
      opacity 120ms ease,
      filter 120ms ease;
  }

  .bar.active {
    filter: saturate(1.18);
    opacity: 1;
  }

  .histogram-tooltip {
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
