<script lang="ts">
  export let label: string;
  export let value: number | null | undefined;
  export let detail: string;
  export let accent = '#2563eb';

  $: score = typeof value === 'number' && Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : null;
  $: dash = score === null ? 0 : score;
</script>

<section class="score-ring-card" style={`--accent: ${accent}; --score: ${dash}`}>
  <div class="score-ring" role="img" aria-label={`${label}: ${score === null ? 'not available' : score.toFixed(0)}`}>
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle class="track" cx="60" cy="60" r="48"></circle>
      <circle class="progress" cx="60" cy="60" r="48" pathLength="100"></circle>
    </svg>
    <div class="score-value">
      {#if score === null}
        <strong>n/a</strong>
      {:else}
        <strong>{score.toFixed(0)}</strong>
      {/if}
      <span>score</span>
    </div>
  </div>
  <div>
    <h3>{label}</h3>
    <p>{detail}</p>
  </div>
</section>

<style>
  .score-ring-card {
    align-items: center;
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent), #ffffff 94%), #ffffff);
    border: 1px solid color-mix(in srgb, var(--accent), #dfe5ee 70%);
    border-radius: 8px;
    box-shadow: 0 8px 28px rgba(22, 26, 33, 0.06);
    display: grid;
    gap: 12px;
    grid-template-columns: 132px minmax(0, 1fr);
    min-width: 0;
    padding: 16px;
  }

  .score-ring {
    aspect-ratio: 1;
    display: grid;
    min-width: 0;
    place-items: center;
    position: relative;
    width: 132px;
  }

  svg {
    height: 100%;
    overflow: visible;
    transform: rotate(-90deg);
    width: 100%;
  }

  circle {
    fill: none;
    stroke-linecap: round;
    stroke-width: 10;
  }

  .track {
    stroke: color-mix(in srgb, var(--accent), #e6ebf2 18%);
  }

  .progress {
    stroke: var(--accent);
    stroke-dasharray: var(--score) 100;
    transition: stroke-dasharray 280ms ease;
  }

  .score-value {
    color: #161a21;
    display: grid;
    gap: 2px;
    inset: 0;
    place-content: center;
    position: absolute;
    text-align: center;
  }

  .score-value strong {
    color: var(--accent);
    font-size: 2.25rem;
    font-weight: 820;
    line-height: 1;
  }

  .score-value span {
    color: #687386;
    font-size: 0.76rem;
    font-weight: 760;
    text-transform: uppercase;
  }

  h3 {
    color: #161a21;
    font-size: 1rem;
    line-height: 1.2;
    margin: 0;
  }

  p {
    color: #596171;
    font-size: 0.88rem;
    line-height: 1.4;
    margin: 8px 0 0;
  }

  @media (max-width: 620px) {
    .score-ring-card {
      grid-template-columns: 104px minmax(0, 1fr);
    }

    .score-ring {
      width: 104px;
    }

    .score-value strong {
      font-size: 1.85rem;
    }
  }
</style>
