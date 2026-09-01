<script lang="ts">
  import { resolve } from '$app/paths';

  const baselineCapabilities = [
    ['Project authority', 'Browser profile'],
    ['Delivery origin', 'localhost:4173'],
    ['Server project data', 'None']
  ] as const;
</script>

<svelte:head>
  <title>Project Library · Venae Machinae</title>
</svelte:head>

<main class="library-shell" data-shell-state="baseline">
  <header class="masthead">
    <a class="wordmark" href={resolve('/')} aria-label="Venae Machinae Project Library">
      <span class="wordmark-mark" aria-hidden="true">VM</span>
      <span>
        <strong>Venae Machinae</strong>
        <small>Vehicle systems workspace</small>
      </span>
    </a>

    <span class="local-badge"><span aria-hidden="true"></span> Local application</span>
  </header>

  <section class="hero" aria-labelledby="library-heading">
    <div class="hero-copy">
      <p class="eyebrow">Project Library</p>
      <h1 id="library-heading">Your vehicle systems work stays in this browser.</h1>
      <p class="hero-summary">
        The local SvelteKit server delivers the application. Project content, engineering evidence,
        and later calculations remain browser-local.
      </p>

      <div class="hero-actions">
        <button type="button" disabled aria-describedby="baseline-explanation">Blank project</button
        >
        <p id="baseline-explanation">Project creation initializes with the browser library.</p>
      </div>
    </div>

    <aside class="boundary-card" aria-labelledby="boundary-heading">
      <p class="eyebrow">Authority boundary</p>
      <h2 id="boundary-heading">One origin. No project endpoint.</h2>
      <dl>
        {#each baselineCapabilities as [term, description] (term)}
          <div>
            <dt>{term}</dt>
            <dd>{description}</dd>
          </div>
        {/each}
      </dl>
    </aside>
  </section>

  <section class="empty-library" aria-labelledby="empty-heading">
    <div class="empty-icon" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <div>
      <p class="eyebrow">Empty library</p>
      <h2 id="empty-heading">No browser-local projects yet</h2>
      <p>The executable baseline is running. Project mutation remains unavailable in this shell.</p>
    </div>
  </section>
</main>
