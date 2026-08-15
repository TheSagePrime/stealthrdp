/* StealthRDP native docs index/article enhancement. */
(function (global) {
  "use strict";

  function normalize(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }

  function filterItems(items, query, category) {
    var term = normalize(query);
    var wantedCategory = normalize(category || "all");
    return (items || []).filter(function (item) {
      var haystack = normalize([item.title, item.summary, item.category].join(" "));
      var categoryMatches = wantedCategory === "all" || normalize(item.category) === wantedCategory;
      return categoryMatches && (!term || haystack.indexOf(term) !== -1);
    });
  }

  function copyText(text) {
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      return global.navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        var copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (copied) resolve(); else reject(new Error("copy failed"));
      } catch (error) {
        document.body.removeChild(textarea);
        reject(error);
      }
    });
  }

  function initIndex() {
    var results = document.querySelector("#docsResults");
    var search = document.querySelector("#docsSearch");
    var category = document.querySelector("#docsCategory");
    if (!results || !search || !category) return;

    var cards = Array.prototype.slice.call(results.querySelectorAll(".docs-card"));
    var items = cards.map(function (card) {
      return {
        element: card,
        card: card,
        title: card.getAttribute("data-doc-title") || "",
        summary: card.getAttribute("data-doc-summary") || "",
        category: card.getAttribute("data-doc-category") || "",
      };
    });
    var count = document.querySelector("#docsResultsCount");
    var empty = document.querySelector("#docsEmpty");
    var topicButtons = Array.prototype.slice.call(document.querySelectorAll("[data-docs-topic]"));
    var groups = Array.prototype.slice.call(results.querySelectorAll(".docs-group"));

    function syncChips() {
      var value = normalize(category.value);
      topicButtons.forEach(function (button) {
        button.classList.toggle("active", normalize(button.getAttribute("data-docs-topic")) === value);
      });
    }

    function render() {
      var visible = filterItems(items, search.value, category.value);
      items.forEach(function (item) { item.element.hidden = visible.indexOf(item) === -1; });
      groups.forEach(function (group) {
        var visibleInGroup = items.some(function (item) { return item.category === group.getAttribute("data-docs-group") && !item.element.hidden; });
        group.hidden = !visibleInGroup;
      });
      syncChips();
      if (count) count.textContent = visible.length + (visible.length === 1 ? " guide" : " guides");
      if (empty) empty.hidden = visible.length !== 0;
    }

    topicButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        category.value = button.getAttribute("data-docs-topic");
        render();
      });
    });
    search.addEventListener("input", render);
    category.addEventListener("change", render);
  }

  function initCopyButtons() {
    Array.prototype.slice.call(document.querySelectorAll(".docs-copy")).forEach(function (button) {
      button.addEventListener("click", function () {
        var target = document.getElementById(button.getAttribute("data-copy-target"));
        var code = target && target.querySelector("code");
        if (!code) return;
        copyText(code.textContent).then(function () {
          var original = button.textContent;
          button.textContent = "Copied";
          setTimeout(function () { button.textContent = original; }, 1200);
        }).catch(function () {
          button.textContent = "Select manually";
          setTimeout(function () { button.textContent = "Copy"; }, 1600);
        });
      });
    });
  }

  if (typeof document !== "undefined") {
    initIndex();
    initCopyButtons();
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { filterItems: filterItems };
  global.SRDP_DOCS = { filterItems: filterItems };
})(typeof window !== "undefined" ? window : globalThis);
