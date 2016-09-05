var script   = document.createElement('script');
script.type  = 'text/javascript';
script.src   = chrome.extension.getURL("magnet-converter.user.js");
script.async = 1;
document.head.appendChild(script);