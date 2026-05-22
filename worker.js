// Minimal Worker entry — delegates all requests to the static asset binding.
// The `[assets]` block in wrangler.toml points at `./out` (Next.js static export),
// so this Worker only needs to forward incoming requests to that binding.
const worker = {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};

export default worker;
