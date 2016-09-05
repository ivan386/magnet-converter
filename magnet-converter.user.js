// ==UserScript==
// @name Magnet Splitter
// @description Splits universal magnet links to suitable for different p2p clients.
// @author ivan386
// @license MIT
// @version 1.0
// @run-at document-end
// @include http://*/*
// @include https://*/*
// ==/UserScript==

(function() {
    'use strict';
	
	function try_decode(data){
		try{
			data = decodeURIComponent(data);
		}catch(e){console.error(e)}
		return data;
	}
			
	function parse_magnet(params, file){
		if (!file) file = {}
		params.replace(/([a-z0-9\.]+)=((([a-z0-9\.]+:)*)([^&]+))&?/gmi,
		function(all, name, data, urn, _, urn_data){
			data = try_decode(data)
			switch (name){
				case "dn":
					file.name = data;
					break;
				case "xl":
					file.size = data;
					break;
				case "br":
					file.bitrate = data;
					break;
				case "tr":
					if (!file.trackers) file.trackers = [];
					file.trackers.push(data);
					break;
				case "x.do":
					if (!file.description_url) file.description_url = [];
					file.description_url.push(data);
					break;
				case "fl":
					if (!file.torrent_file_url) file.torrent_file_url = [];
					file.torrent_file_url.push(data);
					break;
				case "as":
				case "ws":
					if (!file.url) file.url = [];
					file.url.push(data);
					break;
				case "xs":
					if (!file.xurl) file.xurl = [];
					file.xurl.push(data);
					break;
				case "xt":
					if (!file.hash) file.hash = {};
					switch (urn){
						case "urn:sha1:":
							file.hash.sha1 = urn_data;
						break;
						case "urn:ed2k:":
						case "urn:ed2khash:":
							file.hash.ed2k = urn_data;
						break;
						case "urn:aich:":
							file.hash.aich = urn_data;
						break;
						case "urn:btih:":
							if (urn_data.length < 40)
								file.hash.btih = base32_to_hex(urn_data);
							else
								file.hash.btih = urn_data;
						break;
						case "urn:tree:tiger:":
							file.hash.tree_tiger = urn_data;
						break;
						case "urn:bitprint:":
							var sha1_tth = urn_data.split(".");
							if (sha1_tth && sha1_tth.length == 2){
								file.hash.sha1 = sha1_tth[0];
								file.hash.tree_tiger = sha1_tth[1];
								file.hash.bitprint = urn_data;
							}
						break;
					}
				break;
			}
		})
		return file;
	}
	
	function torrent_magnet(file){
		var magnet = ["magnet:?"]
		if (file && file.hash && file.hash.btih) {
			magnet.push("xt=urn:btih:")
			magnet.push(encodeURIComponent(file.hash.btih))
		}else return undefined;
		if (file.name) {
			magnet.push("&dn=")
			magnet.push(encodeURIComponent(file.name))
		}
		if (file.trackers) {
			for (var i=0; i < file.trackers.length; i++){
				magnet.push("&tr=")
				magnet.push(encodeURIComponent(file.trackers[i]))
			}
		}
		if (file.url){
			for (var i=0; i < file.url.length; i++){
				magnet.push("&ws=")
				magnet.push(encodeURIComponent(file.url[i]))
			}
		}
		if (file.torrent_file_url){
			for (var i=0; i < file.torrent_file_url.length; i++){
				magnet.push("&fl=")
				magnet.push(file.torrent_file_url[i])
			}
		}
		return magnet.join("")
	}
	
	function dc_magnet(file){
		var magnet = ["magnet:?"]
		if (file && file.hash && file.hash.tree_tiger) {
			magnet.push("xt=urn:tree:tiger:")
			magnet.push(file.hash.tree_tiger)
		}else return;
		if (file.size) {
			magnet.push("&xl=")
			magnet.push(encodeURIComponent(file.size))
		}
		if (file.name) {
			magnet.push("&dn=")
			magnet.push(encodeURIComponent(file.name))
		}
		if (file.xurl){
			for (var i=0; i < file.xurl.length; i++){
				magnet.push("&xs=")
				magnet.push(file.xurl[i])
			}
		}
		if (file.description_url){
			for (var i=0; i < file.description_url.length; i++){
				magnet.push("&x.do=")
				magnet.push(encodeURIComponent(file.description_url[i]))
			}
		}
		return magnet.join("")
	}
	
	function ed2k_link(file){
		var link = ["ed2k://|file"]
		if (file && file.hash && file.name && file.size && file.hash.ed2k) {
			link.push(encodeURIComponent(file.name))
			link.push(file.size)
			link.push(file.hash.ed2k)
			if (file.hash.aich){
				link.push("h=" + file.hash.aich)
			}
			if (file.url){
				for (var i=0; i < file.url.length; i++){
					link.push("s=" + encodeURIComponent(file.url[i]))
				}
			}
			link.push("/")
			return link.join("|")
		}
	}
	
	function full_magnet(file, as){
		var magnet = ["magnet:?"]
		var amp = false
		if (!file) return;
		if (file.hash && file.hash.ed2k){
			magnet.push("xt=urn:ed2k:")
			magnet.push(file.hash.ed2k)
			amp = true;
		}
		if (file.size) {
			if (amp) magnet.push("&"); else amp = true;
			magnet.push("xl=")
			magnet.push(encodeURIComponent(file.size))
		}
		if (file.name) {
			if (amp) magnet.push("&"); else amp = true;
			magnet.push("dn=")
			magnet.push(encodeURIComponent(file.name))
		}
		if (file.hash){
			if (file.hash.aich){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("xt=urn:aich:")
				magnet.push(file.hash.aich)
			}
			if (file.hash.sha1 && file.hash.tree_tiger){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("xt=urn:bitprint:")
				magnet.push(file.hash.sha1)
				magnet.push(".")
				magnet.push(file.hash.tree_tiger)
			}else if(file.hash.sha1){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("xt=urn:sha1:")
				magnet.push(file.hash.sha1)
			}else if(file.hash.tree_tiger){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("xt=urn:tree:tiger:")
				magnet.push(file.hash.tree_tiger)
			}
			if (file.hash.btih){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("xt=urn:btih:")
				magnet.push(file.hash.btih)
			}
		}
		if (file.trackers){
			for (var i=0; i < file.trackers.length; i++){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("tr=")
				magnet.push(encodeURIComponent(file.trackers[i]))
			}
		}
		if (file.url){
			for (var i=0; i < file.url.length; i++){
				if (amp) magnet.push("&"); else amp = true;
				if (as || !(file.hash && file.hash.btih))
					magnet.push("as=");
				else
					magnet.push("ws=");
				magnet.push(encodeURIComponent(file.url[i]))
			}
		}
		if (file.bitrate){
			if (amp) magnet.push("&"); else amp = true;
			magnet.push("br=")
			magnet.push(encodeURIComponent(file.bitrate))
		}
		if (file.description_url){
			for (var i=0; i < file.description_url.length; i++){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("x.do=")
				magnet.push(encodeURIComponent(file.description_url[i]))
			}
		}
		if (file.torrent_file_url){
			for (var i=0; i < file.torrent_file_url.length; i++){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("fl=")
				magnet.push(encodeURIComponent(file.torrent_file_url[i]))
			}
		}
		if (file.xurl){
			for (var i=0; i < file.xurl.length; i++){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("xs=")
				magnet.push(file.xurl[i])
			}
		}
		return magnet.join("")
	}
	
	function base32_to_hex(base32){
		// http://tools.ietf.org/html/rfc4648
		if (!base32) return "";
		var number = 0
		var bit_pos = 0
		var detector = /[2-7a-z]/gmi
		var hex_str = []
		base32.replace(detector, function(letter){
			var val = parseInt(letter, 36);

			if (val <= 7)
				val += 24;
			else
				val -= 10;
			
			number = ((number << 5) | val) & 255
			bit_pos += 5
			
			for (; bit_pos >= 4;){
				bit_pos -= 4
				var hex_num = (number >> bit_pos) & 15
				hex_str.push(hex_num.toString(16))
			}
		})
		
		return hex_str.join("");
	}
			
	var links = document.getElementsByTagName("A");
	
	function insert_link_after(sibling, href, class_name){
		var new_link = document.createElement("A");
		if (href) new_link.href = href;
		if (class_name) new_link.className = class_name;
		return sibling.parentNode.insertBefore(new_link, sibling.nextSibling)
	}
	
	for (var i = links.length - 1; i >= 0; i--){
		var link = links[i]
		var magnet_index = link.href.indexOf("magnet:?")
		var magnet_link
		
		if (magnet_index < 0){
			magnet_index = link.href.indexOf("magnet%3A%3F")
			if( magnet_index > -1 )
				magnet_link = try_decode(link.href.substr(magnet_index));
		}
		else{
			magnet_link = link.href.substr(magnet_index)
		}
		
		if (magnet_index > -1){
			var file = parse_magnet(magnet_link);
			
			var length = 0
			for(var key in file.hash){
				length ++
			}
			
			if (length > 1)
				console.log("universal magnet")
			else
				console.log("simple magnet")
			
			var magnet_functions = {"torrent-magnet":torrent_magnet, "dc-magnet": dc_magnet, "ed2k-link": ed2k_link, "full-magnet": full_magnet}
			for (var name in magnet_functions){
				var href = magnet_functions[name](file)
				if (href)
					insert_link_after(link, href, name)
			}
			
			console.log(link.href)
		}
	}
	
	document.head.appendChild(document.createElement('style')).appendChild(document.createTextNode(`
[class*='-magnet'], .ed2k-link{
	margin-left: 1em
}
a[class*='-magnet']:before, .ed2k-link:before{
	content: attr(class)
}`))
})();