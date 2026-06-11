<script lang="ts">
  import type { OuraInsight } from '$lib/oura/types';

  export let title = 'Readout';
  export let insights: OuraInsight[] = [];
</script>

<aside class="insight-panel">
  <h2>{title}</h2>
  <div class="insights">
    {#each insights as insight}
      <section>
        <h3>{insight.title}</h3>
        <p>{insight.body}</p>
      </section>
    {/each}
  </div>
</aside>

<style>
  .insight-panel {
    border-left: 3px solid #111827;
    color: #2f3541;
    padding-left: 18px;
  }

  h2 {
    color: #151922;
    font-size: 1rem;
    line-height: 1.2;
    margin: 0 0 14px;
  }

  .insights {
    display: grid;
    gap: 14px;
  }

  section {
    border-bottom: 1px solid #e7ebf1;
    padding-bottom: 13px;
  }

  section:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  h3 {
    color: #303746;
    font-size: 0.88rem;
    margin: 0 0 5px;
  }

  p {
    color: #5a6372;
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0;
  }

  @media (max-width: 860px) {
    .insight-panel {
      border-left: 0;
      border-top: 3px solid #111827;
      padding-left: 0;
      padding-top: 16px;
    }
  }
</style>
