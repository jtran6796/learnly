// Injected into the active tab to extract content.
// Returns: { mode: "selection" | "readability", title, content }
//
// Strategy:
//   1. If the user has selected text >= 100 chars, use that.
//   2. Otherwise run Readability on a cloned document.
//   3. If Readability fails or returns < 200 chars, return an error.

(function extract() {
  // 1. Check selection first
  const sel = window.getSelection?.()?.toString().trim() ?? "";
  if (sel.length >= 100) {
    return {
      mode: "selection",
      title: document.title,
      content: sel,
    };
  }

  // 2. Run Readability on a clone (Readability mutates the doc)
  try {
    const docClone = document.cloneNode(true);
    // Readability is loaded as a separate file before this script runs
    const article = new Readability(docClone).parse();
    if (article && article.textContent && article.textContent.trim().length >= 200) {
      return {
        mode: "readability",
        title: article.title || document.title,
        content: article.textContent.trim(),
      };
    }
  } catch (err) {
    console.warn("Learnly: Readability failed", err);
  }

  // 3. Failure
  return {
    mode: "error",
    error:
      "Couldn't extract enough content from this page. Try selecting the text you want questions about, then click the Learnly icon again.",
  };
})();
