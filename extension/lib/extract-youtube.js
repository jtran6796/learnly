// Injected into the active tab when on a YouTube watch page.
(() => {
  try {
    if (!location.pathname.startsWith("/watch")) {
      return {
        mode: "error",
        error: "Open a YouTube video to use topic mode.",
      };
    }

    const title =
      document.querySelector('meta[property="og:title"]')?.content ||
      document.title.replace(/ - YouTube$/, "");

    if (!title || title.trim().length < 3) {
      return {
        mode: "error",
        error: "Couldn't read the video title. Try refreshing the page.",
      };
    }

    const channel =
      document.querySelector("ytd-channel-name a")?.textContent?.trim() ||
      document.querySelector('link[itemprop="name"]')?.getAttribute("content") ||
      null;

    const description = (
      document.querySelector("#description-inline-expander")?.textContent ||
      document.querySelector('meta[name="description"]')?.content ||
      ""
    )
      .trim()
      .slice(0, 500);

    return {
      mode: "topic",
      topic: title.trim(),
      channel,
      description,
    };
  } catch (err) {
    return {
      mode: "error",
      error: "Extractor threw: " + (err?.message || String(err)),
    };
  }
})();