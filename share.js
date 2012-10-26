// Save image
function saveImage() {
  // Hide button
  var button = document.getElementById("save_button");
  button.style.display = "none";

  // Take screenshot
  // FIXME: Find better way to ensure that button is not
  // included in screenshot other than timeout
  window.setTimeout(function () {
    chrome.tabs.captureVisibleTab(null, {"format":"png"}, function (dataUrl) {
      // Show status message
      button.innerHTML = "Uploading...";
      button.onclick = null;
      button.style.display = "inline-block";
      var img = dataUrl.split(",")[1];
      uploadImage(img);
    });
  }, 10);
}

// Upload image to imgur
function uploadImage(img) {
  var fd = new FormData();
  fd.append("image", img);
  fd.append("type", "base64");
  fd.append("key", "c7e28d7e91fe90261185487c964f683f");

  var xhr = new XMLHttpRequest();
  xhr.open("POST", "http://api.imgur.com/2/upload.json");
  xhr.onload = function() {
    // Hide status message
    document.getElementById("save_button").style.display = "none";
    if (xhr.status === 200) {
      var url = JSON.parse(xhr.responseText).upload.links.original;
      document.getElementById("image_url").href = url;
      document.getElementById("image_url").innerHTML = url;
      document.getElementById("image_url").innerHTML = url;
      document.getElementById("twitter_share").setAttribute("data-url", url);
      loadTwitterButton();
      document.getElementById("share").style.display = "block";
    } else {
      var error = JSON.parse(xhr.responseText).error.message;
      document.getElementById("error_msg").innerHTML = error;
      document.getElementById("error").style.display = "block";
    }
  };
  xhr.send(fd);
}

function loadTwitterButton() {
  !function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src="https://platform.twitter.com/widgets.js";fjs.parentNode.insertBefore(js,fjs);}}(document,"script","twitter-wjs");
}

window.onload = function() {
    // Hide settings in screenshot
  var iframe = document.getElementById("popup");
  iframe.contentWindow.document.getElementById("settings").style.visibility = "hidden";
};

document.addEventListener('DOMContentLoaded', function () {
  document.querySelector('#save_button').addEventListener('click', saveImage);
});
