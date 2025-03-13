// Interval (in seconds) to update timer
var UPDATE_INTERVAL = 3;
// Types to view data
var TYPE = {
  today: "today",
  average: "average",
  all: "all",
};

setDefaults();
// Set default settings
function setDefaults() {
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

// Add sites which are not in the top threshold sites to "other" category
// WARNING: Setting the threshold too low will schew the data set
// so that it will favor sites that already have a lot of time but
// trash the ones that are visited frequently for short periods of time
function combineEntries(threshold) {
  chrome.storage.local.get(["domains", "other"], function (items) {
    var domains = items.domains;
    var other = items.other;
    // Don't do anything if there are less than threshold domains
    if (Object.keys(domains).length <= threshold) {
      return;
    }
    // Sort the domains by decreasing "all" time
    var data = [];
    chrome.storage.local.get(Object.keys(domains), function (domainItems) {
      for (var domain in domains) {
        var domain_data = domainItems[domain];
        data.push({
          domain: domain,
          all: domain_data.all,
        });
      }
      data.sort(function (a, b) {
        return b.all - a.all;
      });
      // Delete data after top threshold and add it to other
      for (var i = threshold; i < data.length; i++) {
        other.all += data[i].all;
        var domain = data[i].domain;
        chrome.storage.local.remove(domain);
        delete domains[domain];
      }
      chrome.storage.local.set({
        other: other,
        domains: domains,
      });
    });
  });
}

// Check to make sure data is kept for the same day
function checkDate() {
  var todayStr = new Date().toLocaleDateString();
  chrome.storage.local.get(["date", "domains", "total"], function (items) {
    var saved_day = items.date;
    if (saved_day !== todayStr) {
      // Reset today's data
      var domains = items.domains;
      for (var domain in domains) {
        chrome.storage.local.get(domain, function (domainData) {
          domainData[domain].today = 0;
          chrome.storage.local.set({ [domain]: domainData[domain] });
        });
      }
      // Reset total for today
      var total = items.total;
      total.today = 0;
      chrome.storage.local.set({ total: total });
      // Combine entries that are not part of top 500 sites
      combineEntries(500);
      // Keep track of number of days web timer has been used
      chrome.storage.local.get("num_days", function (items) {
        chrome.storage.local.set({ num_days: items.num_days + 1 });
      });
      // Update date
      chrome.storage.local.set({ date: todayStr });
    }
  });
}

// Extract the domain from the url
// e.g. http://google.com/ -> google.com
function extractDomain(url) {
  var re = /:\/\/(www\.)?(.+?)\//;
  return url.match(re)[2];
}

function inBlacklist(url) {
  if (!url.match(/^http/)) {
    return true;
  }
  return new Promise((resolve) => {
    chrome.storage.local.get("blacklist", function (items) {
      var blacklist = items.blacklist;
      for (var i = 0; i < blacklist.length; i++) {
        if (url.match(blacklist[i])) {
          resolve(true);
          return;
        }
      }
      resolve(false);
    });
  });
}

// Update the data
function updateData() {
  // Only count time if system has not been idle for 30 seconds
  chrome.idle.queryState(30, function (state) {
    if (state === "active") {
      // Select single active tab from focused window
      chrome.tabs.query(
        { lastFocusedWindow: true, active: true },
        function (tabs) {
          if (tabs.length === 0) {
            return;
          }
          var tab = tabs[0];
          // Make sure 'today' is up-to-date
          checkDate();

          inBlacklist(tab.url).then((isBlacklisted) => {
            if (!isBlacklisted) {
              var domain = extractDomain(tab.url);
              // Add domain to domain list if not already present
              chrome.storage.local.get(["domains", domain], function (items) {
                var domains = items.domains || {};
                if (!(domain in domains)) {
                  domains[domain] = 1;
                  chrome.storage.local.set({ domains: domains });
                }

                var domain_data = items[domain] || {
                  today: 0,
                  all: 0,
                };

                domain_data.today += UPDATE_INTERVAL;
                domain_data.all += UPDATE_INTERVAL;

                chrome.storage.local.set({ [domain]: domain_data });

                // Update total time
                chrome.storage.local.get("total", function (items) {
                  var total = items.total;
                  total.today += UPDATE_INTERVAL;
                  total.all += UPDATE_INTERVAL;
                  chrome.storage.local.set({ total: total });

                  // Update badge with number of minutes spent on current site
                  var num_min = Math.floor(domain_data.today / 60).toString();
                  if (num_min.length < 4) {
                    num_min += "m";
                  }
                  chrome.browserAction.setBadgeText({
                    text: num_min,
                  });
                });
              });
            } else {
              // Clear badge
              chrome.browserAction.setBadgeText({
                text: "",
              });
            }
          });
        }
      );
    }
  });
}

// Update timer data every UPDATE_INTERVAL seconds
setInterval(updateData, UPDATE_INTERVAL * 1000);
