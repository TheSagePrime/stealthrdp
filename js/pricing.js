"use strict";

(function attachPricing(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SRDP_PRICING = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPricingHelper() {
  const CYCLES = {
    monthly: { label: "Monthly", urlKey: "monthly", fallbackSuffix: "/mo" },
    quarterly: { label: "Quarterly", urlKey: "quarterly", fallbackSuffix: "/3mo" },
    annual: { label: "Annual", urlKey: "annually", fallbackSuffix: "/yr" },
    biannual: { label: "Biannual", urlKey: "biannually", fallbackSuffix: "/2yr" },
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[character]));
  }

  function formatAmount(value) {
    return Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function cycleLabel(key) {
    return (CYCLES[key] || CYCLES.monthly).label;
  }

  function cycleUrlKey(key) {
    return (CYCLES[key] || CYCLES.monthly).urlKey;
  }

  function cycleEntry(plan, key) {
    const pricing = plan && plan.pricing ? plan.pricing : {};
    return pricing[key] || null;
  }

  function priceMarkup(plan, key = "monthly") {
    const selectedKey = CYCLES[key] ? key : "monthly";
    const selected = cycleEntry(plan, selectedKey);
    const currency = String((plan && plan.pricing && plan.pricing.currency) || "EUR");
    const symbol = currency === "EUR" ? "€" : currency + " ";
    if (!selected || !Number.isFinite(Number(selected.amount))) {
      return `<div class="plan-price plan-price-unavailable" data-price-cycle="${selectedKey}"><span class="cur">See checkout<small>/${selectedKey}</small></span><span class="price-note">${cycleLabel(selectedKey)} total not published while this plan is out of stock · ${escapeHtml(currency)}</span></div>`;
    }

    const suffix = selected.suffix || (CYCLES[selectedKey] || CYCLES.monthly).fallbackSuffix;
    const condition = selectedKey === "monthly"
      ? `Monthly · ${escapeHtml(currency)}`
      : `${escapeHtml(selected.discountLabel || "")} · billed ${escapeHtml(selected.periodLabel || cycleLabel(selectedKey).toLowerCase())} · ${escapeHtml(currency)}`;
    const reference = Number.isFinite(Number(selected.referenceAmount))
      ? `<span class="was">${symbol}${formatAmount(selected.referenceAmount)}</span>`
      : "";
    return `<div class="plan-price" data-price-cycle="${selectedKey}"><span class="cur">${symbol}${formatAmount(selected.amount)}<small>${escapeHtml(suffix)}</small></span>${reference}<span class="price-note">${condition}</span></div>`;
  }

  function tablePrice(plan) {
    const monthly = cycleEntry(plan, "monthly");
    if (!monthly || !Number.isFinite(Number(monthly.amount))) return "See checkout";
    const currency = String((plan && plan.pricing && plan.pricing.currency) || "EUR");
    const symbol = currency === "EUR" ? "€" : currency + " ";
    return `${symbol}${formatAmount(monthly.amount)}/mo · ${currency}`;
  }

  function cycleButtonMarkup(key, billingCycles = {}) {
    const cycle = billingCycles[key] || CYCLES[key] || CYCLES.monthly;
    const label = cycle.label || CYCLES[key].label;
    const discount = cycle.discountLabel || "";
    return `<button role="tab" aria-selected="${key === "monthly" ? "true" : "false"}" data-cycle="${key}" class="${key === "monthly" ? "active" : ""}">${escapeHtml(label)}${discount ? ` <span class="off">${escapeHtml(discount)}</span>` : ""}</button>`;
  }

  return {
    CYCLES,
    cycleEntry,
    cycleLabel,
    cycleUrlKey,
    formatAmount,
    priceMarkup,
    tablePrice,
    cycleButtonMarkup,
  };
});
