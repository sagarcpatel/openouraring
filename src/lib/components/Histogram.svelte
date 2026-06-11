<script lang="ts">
  import type { HistogramBin } from '$lib/oura/types';

  export let title = '';
  export let bins: HistogramBin[] = [];
  export let color = '#2563eb';
  export let unit = '';
  export let height = 210;

  const width = 720;
  const margin = { top: 16, right: 14, bottom: 36, left: 38 };

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
        <rect
          x={xAt(index)}
          y={yAt(bin.count)}
          width={barWidth()}
          height={height - margin.bottom - yAt(bin.count)}
          rx="2"
          fill={color}
          opacity="0.82"
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
