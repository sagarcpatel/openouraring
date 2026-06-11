<script lang="ts">
  export let label: string;
  export let value: string;
  export let detail: string;
  export let accent = '#2563eb';
  export let tone = 'neutral';
</script>

<section class="metric-card" class:tone-good={tone === 'good'} style={`--accent: ${accent}`}>
  <div class="metric-label">{label}</div>
  <div class="metric-value">{value}</div>
  <div class="metric-detail">{detail}</div>
</section>

<style>
  .metric-card {
    min-width: 0;
    border: 1px solid color-mix(in srgb, var(--accent), #d9dde5 70%);
    border-radius: 8px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent), #ffffff 93%), #ffffff);
    padding: 14px;
    box-shadow: 0 8px 28px rgba(22, 26, 33, 0.06);
  }

  .metric-label {
    color: #5d6472;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .metric-value {
    color: #161a21;
    font-size: clamp(1.75rem, 2.8vw, 2.65rem);
    font-weight: 760;
    line-height: 1.05;
    margin-top: 9px;
    overflow-wrap: anywhere;
  }

  .metric-detail {
    color: #596171;
    font-size: 0.88rem;
    line-height: 1.35;
    margin-top: 8px;
  }

  .tone-good {
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent), #ffffff 89%), #ffffff);
  }
</style>
