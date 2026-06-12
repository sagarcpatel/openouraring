<script lang="ts">
  import {
    Activity,
    ArrowLeft,
    ChartColumn,
    Database,
    ExternalLink,
    GitFork,
    LockKeyhole,
    ShieldCheck,
    UploadCloud
  } from '@lucide/svelte';

  const workflow = [
    {
      icon: UploadCloud,
      label: 'Import',
      body: 'Choose an Oura data export ZIP from the membership portal.'
    },
    {
      icon: Database,
      label: 'Normalize',
      body: 'The app parses CSV files in the browser and builds daily health metrics.'
    },
    {
      icon: ChartColumn,
      label: 'Explore',
      body: 'Charts organize sleep, heart, activity, stress, and oxygen trends into a scannable dashboard.'
    }
  ];

  const privacyPoints = [
    'ZIP parsing happens locally in the browser.',
    'The raw export is not sent to a server by the app.',
    'IndexedDB stores only the normalized summary used by the charts.'
  ];
</script>

<svelte:head>
  <title>About OpenOura</title>
  <meta
    name="description"
    content="OpenOura is a private browser dashboard for exploring Oura Ring CSV exports with locally processed charts."
  />
</svelte:head>

<main class="about-shell">
  <nav class="about-nav" aria-label="About page navigation">
    <a class="brand-link" href="/">
      <span class="brand-mark"><Activity size={20} strokeWidth={2.4} /></span>
      <span>OpenOura</span>
    </a>
    <div class="nav-actions">
      <a href="/">
        <ArrowLeft size={17} strokeWidth={2.4} />
        <span>Dashboard</span>
      </a>
      <a href="https://github.com/exosai/openouraring" target="_blank" rel="noreferrer">
        <GitFork size={17} strokeWidth={2.4} />
        <span>GitHub</span>
      </a>
    </div>
  </nav>

  <section class="about-hero">
    <div class="hero-copy">
      <p class="eyebrow">Private Oura export analysis</p>
      <h1>OpenOura</h1>
      <p>
        OpenOura turns your Oura Ring CSV export into a local dashboard for reviewing long-term sleep, heart, activity,
        stress, and oxygen patterns without uploading the export to a hosted service.
      </p>
      <div class="hero-actions">
        <a class="primary-link" href="/">Open dashboard</a>
        <a class="secondary-link" href="https://www.aleksagordic.com/blog/oura" target="_blank" rel="noreferrer">
          <span>Visualization source</span>
          <ExternalLink size={16} strokeWidth={2.4} />
        </a>
      </div>
    </div>

    <div class="signal-panel" aria-label="OpenOura privacy summary">
      <div class="signal-ring" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="signal-copy">
        <ShieldCheck size={23} strokeWidth={2.35} />
        <strong>Local first</strong>
        <span>Browser parsing, local storage, chart-ready summaries.</span>
      </div>
    </div>
  </section>

  <section class="content-band">
    <div class="section-heading">
      <p class="eyebrow">Purpose</p>
      <h2>Bring exported ring data back into view.</h2>
    </div>
    <p>
      Oura's export gives you raw records, but raw CSVs are slow to inspect. OpenOura is built to make those exports useful:
      it surfaces trends, distributions, rolling averages, and plain-language readouts from data you already own.
    </p>
  </section>

  <section class="workflow-grid" aria-label="How OpenOura works">
    {#each workflow as item}
      <article>
        <div class="workflow-icon"><svelte:component this={item.icon} size={20} strokeWidth={2.35} /></div>
        <h2>{item.label}</h2>
        <p>{item.body}</p>
      </article>
    {/each}
  </section>

  <section class="split-band">
    <div>
      <p class="eyebrow">How it works</p>
      <h2>Everything important happens on your device.</h2>
      <p>
        The dashboard reads the ZIP with browser APIs, parses CSV rows, derives daily metrics, and stores the normalized
        summary in IndexedDB so your next visit can reopen the same dashboard quickly.
      </p>
      <ul>
        {#each privacyPoints as point}
          <li>
            <LockKeyhole size={16} strokeWidth={2.4} />
            <span>{point}</span>
          </li>
        {/each}
      </ul>
    </div>
    <div class="source-panel">
      <p class="eyebrow">Data visualization source</p>
      <h2>Chart selection follows Aleksa Gordic's Oura analysis.</h2>
      <p>
        The dashboard's category structure and visualization selection are adapted from Aleksa Gordic's public Oura data
        analysis write-up.
      </p>
      <a href="https://www.aleksagordic.com/blog/oura" target="_blank" rel="noreferrer">
        <span>Read the source blog</span>
        <ExternalLink size={16} strokeWidth={2.4} />
      </a>
    </div>
  </section>

  <section class="repo-band">
    <div>
      <p class="eyebrow">Open source</p>
      <h2>Source code and issues live on GitHub.</h2>
    </div>
    <a href="https://github.com/exosai/openouraring" target="_blank" rel="noreferrer">
      <GitFork size={18} strokeWidth={2.4} />
      <span>exosai/openouraring</span>
      <ExternalLink size={15} strokeWidth={2.4} />
    </a>
  </section>
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    background: #f4f6f8;
    color: #161a21;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    margin: 0;
  }

  .about-shell {
    background:
      linear-gradient(180deg, #eef3f7 0%, #f8fafc 46%, #f4f6f8 100%);
    min-height: 100vh;
    padding: 22px;
  }

  .about-nav,
  .about-hero,
  .content-band,
  .workflow-grid,
  .split-band,
  .repo-band {
    margin-left: auto;
    margin-right: auto;
    max-width: 1180px;
  }

  .about-nav {
    align-items: center;
    display: flex;
    gap: 16px;
    justify-content: space-between;
  }

  .brand-link,
  .nav-actions a,
  .hero-actions a,
  .source-panel a,
  .repo-band a {
    align-items: center;
    border-radius: 8px;
    display: inline-flex;
    font-weight: 780;
    gap: 8px;
    text-decoration: none;
  }

  .brand-link {
    color: #111827;
    min-width: 0;
  }

  .brand-mark {
    align-items: center;
    background: #111827;
    border-radius: 8px;
    color: #ffffff;
    display: grid;
    flex: 0 0 auto;
    height: 38px;
    justify-items: center;
    width: 38px;
  }

  .nav-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }

  .nav-actions a {
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid #d8e0ea;
    color: #2d3748;
    font-size: 0.86rem;
    min-height: 40px;
    padding: 0 12px;
  }

  .nav-actions a:hover,
  .nav-actions a:focus-visible {
    background: #111827;
    border-color: #111827;
    color: #ffffff;
    outline: none;
  }

  .about-hero {
    align-items: center;
    display: grid;
    gap: 34px;
    grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.72fr);
    padding: 92px 0 54px;
  }

  .hero-copy {
    min-width: 0;
  }

  .eyebrow {
    color: #697386;
    font-size: 0.76rem;
    font-weight: 820;
    letter-spacing: 0;
    margin: 0 0 9px;
    text-transform: uppercase;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  h1 {
    color: #111827;
    font-size: clamp(3.1rem, 8vw, 7.1rem);
    line-height: 0.88;
  }

  h2 {
    color: #111827;
    font-size: clamp(1.55rem, 3vw, 2.45rem);
    line-height: 1.02;
  }

  .hero-copy > p:not(.eyebrow),
  .content-band > p,
  .split-band p,
  .workflow-grid p {
    color: #4b5563;
    font-size: 1rem;
    line-height: 1.65;
  }

  .hero-copy > p:not(.eyebrow) {
    font-size: clamp(1.05rem, 2vw, 1.22rem);
    margin-top: 18px;
    max-width: 710px;
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 26px;
  }

  .primary-link,
  .secondary-link {
    min-height: 44px;
    padding: 0 15px;
  }

  .primary-link {
    background: #111827;
    border: 1px solid #111827;
    color: #ffffff;
  }

  .secondary-link {
    background: #ffffff;
    border: 1px solid #d8e0ea;
    color: #263241;
  }

  .primary-link:hover,
  .primary-link:focus-visible {
    background: #1d4ed8;
    border-color: #1d4ed8;
    outline: none;
  }

  .secondary-link:hover,
  .secondary-link:focus-visible {
    border-color: #93c5fd;
    color: #1d4ed8;
    outline: none;
  }

  .signal-panel {
    background:
      linear-gradient(145deg, rgba(17, 24, 39, 0.98), rgba(27, 38, 54, 0.96));
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    box-shadow: 0 28px 80px rgba(17, 24, 39, 0.2);
    color: #f9fafb;
    display: grid;
    min-height: 360px;
    overflow: hidden;
    place-items: center;
    position: relative;
  }

  .signal-ring {
    aspect-ratio: 1;
    display: grid;
    position: absolute;
    width: min(82%, 330px);
  }

  .signal-ring span {
    border: 1px solid rgba(226, 232, 240, 0.2);
    border-radius: 50%;
    grid-area: 1 / 1;
    transform: scale(var(--scale));
  }

  .signal-ring span:nth-child(1) {
    --scale: 0.56;
    background: rgba(255, 255, 255, 0.05);
  }

  .signal-ring span:nth-child(2) {
    --scale: 0.82;
  }

  .signal-ring span:nth-child(3) {
    --scale: 1.08;
  }

  .signal-copy {
    align-items: center;
    display: grid;
    gap: 10px;
    justify-items: center;
    padding: 28px;
    position: relative;
    text-align: center;
    z-index: 1;
  }

  .signal-copy strong {
    font-size: 1.45rem;
    line-height: 1;
  }

  .signal-copy span {
    color: #cbd5e1;
    font-size: 0.95rem;
    line-height: 1.45;
    max-width: 280px;
  }

  .content-band,
  .split-band,
  .repo-band {
    background: #ffffff;
    border: 1px solid #dfe5ee;
    border-radius: 8px;
  }

  .content-band {
    display: grid;
    gap: 24px;
    grid-template-columns: minmax(250px, 0.68fr) minmax(0, 1fr);
    padding: 28px;
  }

  .workflow-grid {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-top: 14px;
  }

  .workflow-grid article {
    background: #ffffff;
    border: 1px solid #dfe5ee;
    border-radius: 8px;
    padding: 20px;
  }

  .workflow-icon {
    align-items: center;
    background: #eef6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    color: #1d4ed8;
    display: grid;
    height: 42px;
    justify-items: center;
    margin-bottom: 18px;
    width: 42px;
  }

  .workflow-grid h2 {
    font-size: 1.16rem;
    margin-bottom: 8px;
  }

  .split-band {
    display: grid;
    gap: 26px;
    grid-template-columns: minmax(0, 1fr) minmax(290px, 0.72fr);
    margin-top: 14px;
    padding: 28px;
  }

  .split-band h2 {
    margin-bottom: 14px;
  }

  ul {
    display: grid;
    gap: 10px;
    list-style: none;
    margin: 20px 0 0;
    padding: 0;
  }

  li {
    align-items: center;
    color: #374151;
    display: flex;
    gap: 10px;
    line-height: 1.4;
  }

  li :global(svg) {
    color: #0f9f6e;
    flex: 0 0 auto;
  }

  .source-panel {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
  }

  .source-panel h2 {
    font-size: 1.35rem;
  }

  .source-panel a {
    color: #1d4ed8;
    margin-top: 18px;
  }

  .source-panel a:hover,
  .source-panel a:focus-visible {
    color: #111827;
    outline: none;
  }

  .repo-band {
    align-items: center;
    display: flex;
    gap: 18px;
    justify-content: space-between;
    margin-top: 14px;
    padding: 24px 28px;
  }

  .repo-band h2 {
    font-size: clamp(1.35rem, 2vw, 1.9rem);
  }

  .repo-band a {
    background: #111827;
    border: 1px solid #111827;
    color: #ffffff;
    flex: 0 0 auto;
    min-height: 44px;
    padding: 0 14px;
  }

  .repo-band a:hover,
  .repo-band a:focus-visible {
    background: #0f766e;
    border-color: #0f766e;
    outline: none;
  }

  @media (max-width: 840px) {
    .about-shell {
      padding: 16px;
    }

    .about-nav,
    .about-hero,
    .content-band,
    .split-band,
    .repo-band {
      max-width: 100%;
    }

    .about-nav,
    .repo-band {
      align-items: stretch;
      flex-direction: column;
    }

    .nav-actions {
      justify-content: stretch;
    }

    .nav-actions a,
    .repo-band a {
      justify-content: center;
    }

    .about-hero,
    .content-band,
    .workflow-grid,
    .split-band {
      grid-template-columns: 1fr;
    }

    .about-hero {
      padding: 58px 0 26px;
    }

    .signal-panel {
      min-height: 270px;
    }

    .content-band,
    .split-band,
    .repo-band {
      padding: 20px;
    }
  }

  @media (max-width: 520px) {
    .hero-actions,
    .nav-actions {
      display: grid;
    }

    .hero-actions a,
    .nav-actions a {
      width: 100%;
    }

    .primary-link,
    .secondary-link {
      justify-content: center;
    }
  }
</style>
