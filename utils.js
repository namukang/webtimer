export function setDefaultSettings() {
  chrome.storage.local.get(null, function (items) {
    // Set blacklist
    if (!items.blacklist) {
      chrome.storage.local.set({ blacklist: ["example.com"] });
    }
    // Set number of days Web Timer has been used
    if (!items.num_days) {
      chrome.storage.local.set({ num_days: 1 });
    }
    // Set date
    if (!items.date) {
      chrome.storage.local.set({ date: new Date().toLocaleDateString() });
    }
    // Set domains seen before
    if (!items.domains) {
      chrome.storage.local.set({ domains: {} });
    }
    // Set total time spent
    if (!items.total) {
      chrome.storage.local.set({
        total: {
          today: 0,
          all: 0,
        },
      });
    }
    // Limit how many sites the chart shows
    if (!items.chart_limit) {
      chrome.storage.local.set({ chart_limit: 7 });
    }
    // Set "other" category
    // NOTE: other.today is not currently used
    if (!items.other) {
      chrome.storage.local.set({
        other: {
          today: 0,
          all: 0,
        },
      });
    }
  });
}
