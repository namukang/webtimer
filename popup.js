var bg = chrome.extension.getBackgroundPage();

// Load the Visualization API and the piechart package.
google.charts.load("current", { packages: ["corechart", "table"] });
// Set a callback to run when the Google Visualization API is loaded.
if (window.top === window.self) {
  google.charts.setOnLoadCallback(function () {
    show(bg.TYPE.today);
  });
} else {
  // For screenshot: if in iframe, load the most recently viewed mode
  google.charts.setOnLoadCallback(function () {
    if (bg.mode === bg.TYPE.today) {
      show(bg.TYPE.today);
    } else if (bg.mode === bg.TYPE.average) {
      show(bg.TYPE.average);
    } else if (bg.mode === bg.TYPE.all) {
      show(bg.TYPE.all);
    } else {
      console.error("No such type: " + bg.mode);
    }
  });
}

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
        if (type === bg.TYPE.today) {
          numSeconds = domain_data.today;
        } else if (type === bg.TYPE.average) {
          chrome.storage.local.get("num_days", function (items) {
            numSeconds = Math.floor(domain_data.all / items.num_days);
          });
        } else if (type === bg.TYPE.all) {
          numSeconds = domain_data.all;
        } else {
          console.error("No such type: " + type);
        }
        if (numSeconds > 0) {
          chart_data.push([
            domain,
            {
              v: numSeconds,
              f: timeString(numSeconds),
              p: {
                style: "text-align: left; white-space: normal;",
              },
            },
          ]);
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
        return b[1].v - a[1].v;
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
          sum += chart_data[i][1].v;
        }

        // Add time in "other" category for total and average
        chrome.storage.local.get(["other", "num_days"], function (items) {
          var other = items.other;
          if (type === bg.TYPE.average) {
            sum += Math.floor(other.all / items.num_days);
          } else if (type === bg.TYPE.all) {
            sum += other.all;
          }
          if (sum > 0) {
            limited_data.push([
              "Other",
              {
                v: sum,
                f: timeString(sum),
                p: {
                  style: "text-align: left; white-space: normal;",
                },
              },
            ]);
          }

          // Draw the chart
          drawChart(limited_data);

          // Add total time
          chrome.storage.local.get(["total", "num_days"], function (items) {
            var total = items.total;
            var numSeconds = 0;
            if (type === bg.TYPE.today) {
              numSeconds = total.today;
            } else if (type === bg.TYPE.average) {
              numSeconds = Math.floor(total.all / items.num_days);
            } else if (type === bg.TYPE.all) {
              numSeconds = total.all;
            } else {
              console.error("No such type: " + type);
            }
            limited_data.push([
              {
                v: "Total",
                p: {
                  style: "font-weight: bold;",
                },
              },
              {
                v: numSeconds,
                f: timeString(numSeconds),
                p: {
                  style:
                    "text-align: left; white-space: normal; font-weight: bold;",
                },
              },
            ]);

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
  bg.mode = mode;
  displayData(mode);
  updateNav(mode);
}

// Callback that creates and populates a data table,
// instantiates the pie chart, passes in the data and
// draws it.
function drawChart(chart_data) {
  // Create the data table.
  var data = new google.visualization.DataTable();
  data.addColumn("string", "Domain");
  data.addColumn("number", "Time");
  data.addRows(chart_data);

  // Set chart options
  var options = {
    tooltip: {
      text: "percentage",
    },
    chartArea: {
      width: 400,
      height: 180,
    },
  };

  // Instantiate and draw our chart, passing in some options.
  var chart = new google.visualization.PieChart(
    document.getElementById("chart_div")
  );
  chart.draw(data, options);
}

function drawTable(table_data, type) {
  var data = new google.visualization.DataTable();
  data.addColumn("string", "Domain");
  var timeDesc;
  if (type === bg.TYPE.today) {
    timeDesc = "Today";
  } else if (type === bg.TYPE.average) {
    chrome.storage.local.get("num_days", function (items) {
      timeDesc = "Daily Average";
    });
  } else if (type === bg.TYPE.all) {
    chrome.storage.local.get("num_days", function (items) {
      timeDesc = "Over " + items.num_days + " Days";
    });
  } else {
    console.error("No such type: " + type);
  }
  data.addColumn("number", "Time Spent (" + timeDesc + ")");
  data.addRows(table_data);

  var options = {
    allowHtml: true,
    sort: "disable",
    width: "100%",
    height: "100%",
  };
  var table = new google.visualization.Table(
    document.getElementById("table_div")
  );
  table.draw(data, options);
}

document.addEventListener("DOMContentLoaded", function () {
  document.querySelector("#today").addEventListener("click", function () {
    show(bg.TYPE.today);
  });
  document.querySelector("#average").addEventListener("click", function () {
    show(bg.TYPE.average);
  });
  document.querySelector("#all").addEventListener("click", function () {
    show(bg.TYPE.all);
  });

  document.querySelector("#options").addEventListener("click", showOptions);
});
