var bg = chrome.extension.getBackgroundPage();

// Saves options to chrome.storage.local
function save_options() {
  // Save blacklist domains
  var blackListEl = document.getElementById("blacklist");
  var blacklist_domains = blackListEl.value.split(/\r?\n/);
  var blacklist = [];
  // Get rid of empty lines
  for (var i = 0; i < blacklist_domains.length; i++) {
    var domain = blacklist_domains[i];
    if (domain) {
      blacklist.push(domain);
    }
  }
  blackListEl.value = blacklist.join("\n");
  chrome.storage.local.set({ blacklist: blacklist });

  // Remove data for sites that have been added to the blacklist
  chrome.storage.local.get("domains", function (items) {
    var domains = items.domains;
    for (var domain in domains) {
      for (var i = 0; i < blacklist.length; i++) {
        if (domain.match(blacklist[i])) {
          // Remove data for any domain on the blacklist
          delete domains[domain];
          chrome.storage.local.remove(domain);
          chrome.storage.local.set({ domains: domains });
        }
      }
    }
  });

  // Check limit data
  var limit_data = document.getElementById("chart_limit");
  var limit = parseInt(limit_data.value);
  if (limit) {
    chrome.storage.local.set({ chart_limit: limit });
    limit_data.value = limit;
  } else {
    chrome.storage.local.get("chart_limit", function (items) {
      limit_data.value = items.chart_limit;
    });
  }

  // Update status to let user know options were saved.
  var status = document.getElementById("status");
  status.innerHTML = "Options Saved.";
  status.className = "success";
  setTimeout(function () {
    status.innerHTML = "";
    status.className = "";
  }, 750);
}

// Restores select box state to saved value from chrome.storage.local
function restore_options() {
  chrome.storage.local.get(["blacklist", "chart_limit"], function (items) {
    var blacklist = items.blacklist;
    var blackListEl = document.getElementById("blacklist");
    blackListEl.value = blacklist.join("\n");
    var limitEl = document.getElementById("chart_limit");
    limitEl.value = items.chart_limit;
  });
}

// Clear all data except for blacklist
function clearData() {
  // Clear everything except for blacklist
  chrome.storage.local.get("blacklist", function (items) {
    var blacklist = items.blacklist;
    chrome.storage.local.clear(function () {
      chrome.storage.local.set({ blacklist: blacklist }, function () {
        bg.setDefaults();
        location.reload();
      });
    });
  });
}

document.addEventListener("DOMContentLoaded", function () {
  // Restore options
  restore_options();

  // Set handlers for option descriptions
  document
    .querySelector("#save-button")
    .addEventListener("click", save_options);
  document.querySelector("#clear-data").addEventListener("click", clearData);
  var rows = document.querySelectorAll("tr");
  var mouseoverHandler = function () {
    this.querySelector(".description").style.visibility = "visible";
  };
  var mouseoutHandler = function () {
    this.querySelector(".description").style.visibility = "hidden";
  };
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    row.addEventListener("mouseover", mouseoverHandler);
    row.addEventListener("mouseout", mouseoutHandler);
  }
});
