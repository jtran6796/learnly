(() => {
  try {
    if (!location.pathname.startsWith("/watch")) {
      return {
        mode: "error",
        error: "Open a YouTube video to use topic mode.",
      };
    }

    // Read title from the live H1 in the player, NOT og:title (which is stale on SPA navigation)
    const titleEl =
      document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
      document.querySelector("h1.ytd-watch-metadata") ||
      document.querySelector("#title h1");
    let title = titleEl?.textContent?.trim() || "";

    // Fallback to document.title (which updates on SPA navigation, unlike og:title)
    if (!title) {
      title = document.title.replace(/^\(\d+\)\s*/, "").replace(/ - YouTube$/, "");
    }

    if (!title || title.length < 3) {
      return {
        mode: "error",
        error: "Couldn't read the video title. Try refreshing the page.",
      };
    }

    // Channel: live DOM only
    const channel =
      document.querySelector("ytd-channel-name #channel-name a")?.textContent?.trim() ||
      document.querySelector("ytd-channel-name a")?.textContent?.trim() ||
      null;

    // Description: live DOM only (meta description is stale on SPA nav)
    const description = (
      document.querySelector("#description-inline-expander")?.textContent ||
      document.querySelector("ytd-text-inline-expander")?.textContent ||
      ""
    )
      .trim()
      .slice(0, 500);

    return {
      mode: "topic",
      topic: title,
      channel,
      description,
      // Debug: include the URL so we can verify in the side panel
      _url: location.href,
    };
  } catch (err) {
    return {
      mode: "error",
      error: "Extractor threw: " + (err?.message || String(err)),
    };
  }
})();