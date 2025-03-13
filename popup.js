var bg = chrome.extension.getBackgroundPage();

// Define constants for type
const TYPE = bg.TYPE;
let pieChart = null;

// Set up initial display when document is loaded
window.addEventListener("DOMContentLoaded", () => {
  show(TYPE.today);
});

// Show options in a new tab
function showOptions() {
  chrome.tabs.create({
    url: "options.html",
  });
}

// Converts duration to String
function timeString(numSeconds) {
  if (numSeconds === 0) {
    return "0 seconds";
  }
  var remainder = numSeconds;
  var timeStr = "";
  var timeTerms = {
    hour: 3600,
    minute: 60,
    second: 1,
  };
  // Don't show seconds if time is more than one hour
  if (remainder >= timeTerms.hour) {
    remainder = remainder - (remainder % timeTerms.minute);
    delete timeTerms.second;
  }
  // Construct the time string
  for (var term in timeTerms) {
    var divisor = timeTerms[term];
    if (remainder >= divisor) {
      var numUnits = Math.floor(remainder / divisor);
      timeStr += numUnits + " " + term;
      // Make it plural
      if (numUnits > 1) {
        timeStr += "s";
      }
      remainder = remainder % divisor;
      if (remainder) {
        timeStr += " and ";
      }
    }
  }
  return timeStr;
}

// Show the data for the time period indicated by addon
function displayData(type) {
  // Get the domain data
  chrome.storage.local.get(["domains"], function (items) {
    var domains = items.domains;
    var chart_data = [];

    // Get all domain data at once
    var domainKeys = Object.keys(domains);
    chrome.storage.local.get(domainKeys, function (domainItems) {
      for (var domain in domains) {
        var domain_data = domainItems[domain];
        var numSeconds = 0;
        if (type === TYPE.today) {
          numSeconds = domain_data.today;
        } else if (type === TYPE.average) {
          chrome.storage.local.get("num_days", function (items) {
            numSeconds = Math.floor(domain_data.all / items.num_days);
          });
        } else if (type === TYPE.all) {
          numSeconds = domain_data.all;
        } else {
          console.error("No such type: " + type);
        }
        if (numSeconds > 0) {
          chart_data.push({
            domain: domain,
            seconds: numSeconds,
            formatted: timeString(numSeconds),
          });
        }
      }

      // Display help message if no data
      if (chart_data.length === 0) {
        document.getElementById("nodata").style.display = "inline";
      } else {
        document.getElementById("nodata").style.display = "none";
      }

      // Sort data by descending duration
      chart_data.sort(function (a, b) {
        return b.seconds - a.seconds;
      });

      // Limit chart data
      var limited_data = [];
      var chart_limit;
      // For screenshot: if in iframe, image should always have 9 items
      if (top == self) {
        chrome.storage.local.get("chart_limit", function (items) {
          chart_limit = items.chart_limit;
          processChartData();
        });
      } else {
        chart_limit = 9;
        processChartData();
      }

      function processChartData() {
        for (var i = 0; i < chart_limit && i < chart_data.length; i++) {
          limited_data.push(chart_data[i]);
        }
        var sum = 0;
        for (var i = chart_limit; i < chart_data.length; i++) {
          sum += chart_data[i].seconds;
        }

        // Add time in "other" category for total and average
        chrome.storage.local.get(["other", "num_days"], function (items) {
          var other = items.other;
          if (type === TYPE.average) {
            sum += Math.floor(other.all / items.num_days);
          } else if (type === TYPE.all) {
            sum += other.all;
          }
          if (sum > 0) {
            limited_data.push({
              domain: "Other",
              seconds: sum,
              formatted: timeString(sum),
            });
          }

          // Draw the chart
          drawChart(limited_data);

          // Add total time
          chrome.storage.local.get(["total", "num_days"], function (items) {
            var total = items.total;
            var numSeconds = 0;
            if (type === TYPE.today) {
              numSeconds = total.today;
            } else if (type === TYPE.average) {
              numSeconds = Math.floor(total.all / items.num_days);
            } else if (type === TYPE.all) {
              numSeconds = total.all;
            } else {
              console.error("No such type: " + type);
            }

            // Add total row
            limited_data.push({
              domain: "Total",
              seconds: numSeconds,
              formatted: timeString(numSeconds),
              isTotal: true,
            });

            // Draw the table
            drawTable(limited_data, type);
          });
        });
      }
    });
  });
}

function updateNav(type) {
  document.getElementById("today").className = "";
  document.getElementById("average").className = "";
  document.getElementById("all").className = "";
  document.getElementById(type).className = "active";
}

function show(mode) {
  displayData(mode);
  updateNav(mode);
}

// Create and draw the pie chart using Chart.js
function drawChart(chart_data) {
  // Destroy previous chart if it exists
  if (pieChart) {
    pieChart.destroy();
  }

  // Prepare data for Chart.js
  const labels = chart_data.map((item) => item.domain);
  const data = chart_data.map((item) => item.seconds);

  // Generate random colors for the chart (or use a predefined color scheme)
  const colors = generateColors(chart_data.length);

  // Get the canvas element
  const ctx = document.getElementById("pieChart").getContext("2d");

  // Create the chart
  pieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: colors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || "";
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return `${label}: ${percentage}% (${timeString(value)})`;
            },
          },
        },
      },
    },
  });
}

// Create a color array for the chart
function generateColors(count) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    // Use standard colors or generate random ones
    colors.push(`hsl(${((i * 360) / count) % 360}, 70%, 60%)`);
  }
  return colors;
}

// Draw the HTML table
function drawTable(table_data, type) {
  const tableBody = document.getElementById("tableBody");
  tableBody.innerHTML = ""; // Clear existing content

  // Update the table header based on type
  let timeDesc;
  if (type === TYPE.today) {
    timeDesc = "Today";
  } else if (type === TYPE.average) {
    chrome.storage.local.get("num_days", function (items) {
      document.querySelector(
        "#dataTable th:last-child"
      ).textContent = `Time Spent (Daily Average)`;
    });
    timeDesc = "Daily Average";
  } else if (type === TYPE.all) {
    chrome.storage.local.get("num_days", function (items) {
      document.querySelector(
        "#dataTable th:last-child"
      ).textContent = `Time Spent (Over ${items.num_days} Days)`;
    });
    timeDesc = "All Time";
  }

  document.querySelector(
    "#dataTable th:last-child"
  ).textContent = `Time Spent (${timeDesc})`;

  // Add rows to the table
  table_data.forEach((item) => {
    const row = document.createElement("tr");

    // Apply special styling for total row
    if (item.isTotal) {
      row.className = "total-row";
    }

    const domainCell = document.createElement("td");
    domainCell.textContent = item.domain;

    const timeCell = document.createElement("td");
    timeCell.textContent = item.formatted;

    row.appendChild(domainCell);
    row.appendChild(timeCell);
    tableBody.appendChild(row);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  document.querySelector("#today").addEventListener("click", function () {
    show(TYPE.today);
  });
  document.querySelector("#average").addEventListener("click", function () {
    show(TYPE.average);
  });
  document.querySelector("#all").addEventListener("click", function () {
    show(TYPE.all);
  });

  document.querySelector("#options").addEventListener("click", showOptions);
});
