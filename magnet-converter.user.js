// ==UserScript==
// @name Magnet Splitter
// @description Splits universal magnet links to suitable for different p2p clients.
// @author ivan386
// @license MIT
// @version 1.1
// @run-at document-end
// @include http://*/*
// @include https://*/*
// ==/UserScript==

javascript:
/*
	Букмарклет
	
	Этот скрипт можно скопировать и сохранить в закладки (от "javascript:" до "void();" включительно).
	
	Для корректной работы скрипта в букмарклете используем только внутристрочные комментарии и завершаем инструкции точкой с запятой.
*/
(function() {
    'use strict';


	function try_decode(data){
		try{
			data = decodeURIComponent(data);
		}catch(e){console.error(e)}
		return data;
	}


/*
Разбираем магнит на части
*/

	function detect_ipfs_hash(url, file)
	{
		url.replace(/\/ipfs\/([123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+)/,function(all, hash){
			if (!file.hash) file.hash = {};
			file.hash.ipfs = hash;
		});
		return;
	}

	function parse_urn(urn_name, urn_data, file)
	{
		if (!file.hash) file.hash = {};
		switch (urn_name){
			case "urn:sha1:": /* sha1 хеш  файла (Base32) */
				file.hash.sha1 = urn_data;
			break;
			case "urn:ed2k:": /* ed2k хеш  файла (Hex) */
			case "urn:ed2khash:":
				file.hash.ed2k = urn_data;
			break;
			case "urn:aich:": /* Advanced Intelligent Corruption  */
				file.hash.aich = urn_data;
			break;
			case "urn:btih:": /* BitTorrent Info Hash (Hex, Base32) */
				if (urn_data.length < 40)
					file.hash.btih = base32_to_hex(urn_data);
				else 
					file.hash.btih = urn_data;
			break;
			case "urn:ipfs:": /* InterPlanetary File System мультихеш */
				file.hash.ipfs = urn_data;
			break;
			case "urn:tree:tiger:": /* Tiger Tree Hash (TTH) файла (Base32) */
				file.hash.tree_tiger = urn_data;
			break;
			case "urn:bitprint:": /* [SHA1].[TTH] (Base32) */
				var sha1_tth = urn_data.split(".");
				if (sha1_tth && sha1_tth.length == 2){
					file.hash.sha1 = sha1_tth[0];
					file.hash.tree_tiger = sha1_tth[1];
					file.hash.bitprint = urn_data;
				};
			break;
			default: /* другие идентификаторы тоже сохраняем */
				if (!file.urns) file.urns = [];
				file.urns.push(urn_name+urn_data);
		}
	}
	
	function parse_magnet(params, file){
		if (!file) file = {};
		params.replace(/([a-z0-9\.]+)=((([a-z0-9\.]+:)*)([^&]+))&?/gmi,
		function(all, name, data, urn, _, urn_data){
			data = try_decode(data);
			switch (name){
				case "dn": /* (Display Name) — имя файла. */
					file.name = data;
					break;
				case "xl": /* (eXact Length) — размер файла в байтах. */
					file.size = data;
					break;
				case "br": /* Битрейт - скорость последовательной загрузки файла для его воспроизведения. */
					file.bitrate = data;
					break;
				case "tr": /* (TRacker) — адрес трекера для BitTorrent клиентов. */
					if (!file.trackers) file.trackers = [];
					file.trackers.push(data);
					break;
				case "mt":	
					file.collection = file.collection || [];
					file.collection.push(data);
					break;
				case "x.do": /* Ссылка на страницу описания файла. */
					if (!file.description_url) file.description_url = [];
					file.description_url.push(data);
					break;
				case "fl": /* Ссылка на торрент файл. */
					if (!file.torrent_file_url) file.torrent_file_url = [];
					file.torrent_file_url.push(data);
					break;
				case "as": /* (Acceptable Source) — веб-ссылка на файл в Интернете. */
				case "ws": /* Web Seed - прямая ссылка на файл или каталог для загрузки. */
					if (!file.url) file.url = [];
					file.url.push(data);
					detect_ipfs_hash(data, file);
					break;
				case "xs": /* (eXact Source) — ссылка на источник файла в P2P сети. */
					if (!file.xurl) file.xurl = [];
					file.xurl.push(data);
					detect_ipfs_hash(data, file);
					break;
				case "xt": /* URN, содержащий хеш */
					parse_urn(urn, urn_data, file);
					break;
				case "x.ed2k.p":
					(file.hash_list = file.hash_list || {}).ed2k = data.split(":");
					break;
			}
		});
		return file;
	}


/* 
Здесь происходит сборка магнита для торрента

Торрент клиенту нужен прежде всего bittorrent info hash (btih).
Он следует первым и обязателен для этого типа магнита.

Пример магнита:
magnet:?xt=urn:btih:16253d9beb0df49fe30bacc62ea10ba63939f0f8&dn=ruwiki-20141114-pages-meta-current.xml.bz2&tr=http%3A%2F%2Furl2torrent.net%3A6970%2Fannounce&ws=http%3A%2F%2Fdumps.wikimedia.org%2Fruwiki%2F20141114%2Fruwiki-20141114-pages-meta-current.xml.bz2&fl=http://torcache.net/torrent/16253D9BEB0DF49FE30BACC62EA10BA63939F0F8.torrent

*/
	function torrent_magnet(file){
		var magnet = ["magnet:?"];
		if (file && file.hash && file.hash.btih) {
			magnet.push("xt=urn:btih:");
			magnet.push(encodeURIComponent(file.hash.btih));
		}else return undefined;
		if (file.name) {
			magnet.push("&dn=");
			magnet.push(encodeURIComponent(file.name));
		}
		if (file.trackers) {
			for (var i=0; i < file.trackers.length; i++){
				magnet.push("&tr=");
				magnet.push(encodeURIComponent(file.trackers[i]));
			}
		}
		if (file.url){
			for (var i=0; i < file.url.length; i++){
				magnet.push("&ws=");
				magnet.push(encodeURIComponent(file.url[i]));
			}
		}
		if (file.torrent_file_url){
			for (var i=0; i < file.torrent_file_url.length; i++){
				magnet.push("&fl=");
				magnet.push(file.torrent_file_url[i]);
			}
		}
		return magnet.join("");
	}


/*
Эта функция собирает магнит для DirectConnect(DC++) клиентов.

Для них обязателен tree tiger hash(TTH). Некоторые клиенты понимают и urn:bitprint в котором также содержится TTH но urn:tree:tiger: должны понимать все.
Если не будет остальных параметров DC++ откроет окно поиска файла по TTH.

Пример магнита:
magnet:?xt=urn:tree:tiger:JNOANHGPELY63I2OMSPQ3J73AS2P4AWB5MTBJCQ&xl=2981763794&dn=ruwiki-20141114-pages-meta-current.xml.bz2&xs=http://cache.freebase.be/u24iyrp3wtlry5kjh7sacblft2lam62u&xs=dchub://allavtovo.ru&x.do=https%3A%2F%2Fdumps.wikimedia.org%2Fruwiki%2F20141114%2F

*/
	function dc_magnet(file){
		var magnet = ["magnet:?"];
		if (file && file.hash && file.hash.tree_tiger) {
			magnet.push("xt=urn:tree:tiger:");
			magnet.push(file.hash.tree_tiger);
		}else return;
		if (file.size) {
			magnet.push("&xl=");
			magnet.push(encodeURIComponent(file.size));
		}
		if (file.name) {
			magnet.push("&dn=");
			magnet.push(encodeURIComponent(file.name));
		}
		if (file.description_url){
			for (var i=0; i < file.description_url.length; i++){
				magnet.push("&x.do=");
				magnet.push(encodeURIComponent(file.description_url[i]));
			}
		}
		if (file.xurl){
			for (var i=0; i < file.xurl.length; i++){
				magnet.push("&xs=");
				magnet.push(file.xurl[i]);
			}
		}
		return magnet.join("");
	}


/*
Здесь собирается ed2k ссылка.

На данный момент магниты из Edonkey2000 клиентов понимал только aMule. Поэтому мы собираем стандартную для этой сети ed2k ссылку.

Пример ссылки:
ed2k://|file|ruwiki-20141114-pages-meta-current.xml.bz2|2981763794|0218392e98873112284de6913efee0df|s=http%3A%2F%2Fdumps.wikimedia.org%2Fruwiki%2F20141114%2Fruwiki-20141114-pages-meta-current.xml.bz2|/

*/
	function ed2k_link(file){
		var link = ["ed2k://|file"];
		if (file && file.hash && file.name && file.size && file.hash.ed2k) {
			link.push(encodeURIComponent(file.name));
			link.push(file.size);
			link.push(file.hash.ed2k);
			if (file.hash.aich)
				link.push("h=" + file.hash.aich);
			
			
			if (file.hash_list && file.hash_list.ed2k)
				link.push("p=" + file.hash_list.ed2k.join(":"));
			
			
			if (file.url)
				for (var i=0; i < file.url.length; i++)
					link.push("s=" + encodeURIComponent(file.url[i]));
				
			
			
			if (file.collection)
				for (var i=0; i < file.collection.length; i++)
					link.push("f=" + encodeURIComponent(file.collection[i]));
				
			
			
			if (file.xurl){
				var sources = [];
				file.xurl.map(
					function (xurl){
						var matches = (/ed2kftp\:\/\/([^\/]+)\/[a-z0-9]+\/[0-9]+\//gmi).exec(xurl);
						if (matches)
							sources.push(matches[1]);
					}
				);
				if ( sources.length > 0 )
					link.push("/|sources," + sources.join(","));
			}
			
			link.push("/");
			return link.join("|");
		}
	}


/*
Полный магнит

Этот магнит может использовать любой p2p клиент если в нём содержатся нужные ему хеши. Но справляется с этой задачей пока только Shareaza.

Пример магнита:
magnet:?xt=urn:ed2k:0218392e98873112284de6913efee0df&xl=2981763794&dn=ruwiki-20141114-pages-meta-current.xml.bz2&xt=urn:bitprint:U24IYRP3WTLRY5KJH7SACBLFT2LAM62U.JNOANHGPELY63I2OMSPQ3J73AS2P4AWB5MTBJCQ&xt=urn:btih:16253d9beb0df49fe30bacc62ea10ba63939f0f8&tr=http%3A%2F%2Furl2torrent.net%3A6970%2Fannounce&ws=http%3A%2F%2Fdumps.wikimedia.org%2Fruwiki%2F20141114%2Fruwiki-20141114-pages-meta-current.xml.bz2&x.do=https%3A%2F%2Fdumps.wikimedia.org%2Fruwiki%2F20141114%2F&fl=http%3A%2F%2Ftorcache.net%2Ftorrent%2F16253D9BEB0DF49FE30BACC62EA10BA63939F0F8.torrent&xs=http://cache.freebase.be/u24iyrp3wtlry5kjh7sacblft2lam62u&xs=dchub://allavtovo.ru

*/
	function full_magnet(file, as){
		var magnet = ["magnet:?"];
		var amp = false;
		if (!file) return;
		if (file.hash){
			if (file.hash.btih){
				magnet.push("xt=urn:btih:");
				magnet.push(file.hash.btih);
				amp = true;
			}
			if (file.hash.sha1 && file.hash.tree_tiger){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("xt=urn:bitprint:");
				magnet.push(file.hash.sha1);
				magnet.push(".");
				magnet.push(file.hash.tree_tiger);
			}else if(file.hash.sha1){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("xt=urn:sha1:");
				magnet.push(file.hash.sha1);
			}else if(file.hash.tree_tiger){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("xt=urn:tree:tiger:");
				magnet.push(file.hash.tree_tiger);
			}
			if (file.hash.ed2k){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("xt=urn:ed2k:");
				magnet.push(file.hash.ed2k);
			}
		}
		if (file.size) {
			if (amp) magnet.push("&"); else amp = true;
			magnet.push("xl=");
			magnet.push(encodeURIComponent(file.size));
		}
		if (file.name) {
			if (amp) magnet.push("&"); else amp = true;
			magnet.push("dn=");
			magnet.push(encodeURIComponent(file.name));
		}
		if (file.hash){
			if (file.hash.aich){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("xt=urn:aich:");
				magnet.push(file.hash.aich);
			}
			if (file.hash.ipfs){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("xt=urn:ipfs:");
				magnet.push(file.hash.ipfs);
			}
		}
		if (file.urns){
			file.urns.map((urn)=>{
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("xt=");
				magnet.push(urn);
			})
		}
		if (file.trackers){
			for (var i=0; i < file.trackers.length; i++){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("tr=");
				magnet.push(encodeURIComponent(file.trackers[i]));
			}
		}
		if (file.url){
			for (var i=0; i < file.url.length; i++){
				if (amp) magnet.push("&"); else amp = true;
				if (as || !(file.hash && file.hash.btih))
					magnet.push("as=");
				else 
					magnet.push("ws=");
				magnet.push(encodeURIComponent(file.url[i]));
			}
		}
		if (file.bitrate){
			if (amp) magnet.push("&"); else amp = true;
			magnet.push("br=");
			magnet.push(encodeURIComponent(file.bitrate));
		}
		if (file.description_url){
			for (var i=0; i < file.description_url.length; i++){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("x.do=");
				magnet.push(encodeURIComponent(file.description_url[i]));
			}
		}
		if (file.torrent_file_url){
			for (var i=0; i < file.torrent_file_url.length; i++){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("fl=");
				magnet.push(encodeURIComponent(file.torrent_file_url[i]));
			}
		}
		if (file.collection){
			for (var i=0; i < file.collection.length; i++){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("mt=");
				magnet.push(encodeURIComponent(file.collection[i]));
			}
		}
		if (file.hash_list && file.hash_list.ed2k){
			if (amp) magnet.push("&"); else amp = true;
			magnet.push("x.ed2k.p=");
			magnet.push(file.hash_list.ed2k.join(":"));
		}
		if (file.xurl){
			for (var i=0; i < file.xurl.length; i++){
				if (amp) magnet.push("&"); else amp = true;
				magnet.push("xs=");
				magnet.push(file.xurl[i]);
			}
		}
		if ( magnet.length > 1 )
			return magnet.join("");
	}


/*
Раньше в магнитах для торрента использовалось base32 кодирование btih. Сейчас используется HEX. Shareaza по старинке использует Base32 и эта функция конвертирует btih обратно в HEX.
*/
	function base32_to_hex(base32){
		/* http://tools.ietf.org/html/rfc4648 */
		if (!base32) return "";
		var number = 0;
		var bit_pos = 0;
		var detector = /[2-7a-z]/gmi;
		var hex_str = [];
		base32.replace(detector, function(letter){
			var val = parseInt(letter, 36);

			if (val <= 7)
				val += 24;
			else 
				val -= 10;
			
			number = ((number << 5) | val) & 255;
			bit_pos += 5;
			
			for (; bit_pos >= 4;){
				bit_pos -= 4;
				var hex_num = (number >> bit_pos) & 15;
				hex_str.push(hex_num.toString(16));
			}
		});
		
		return hex_str.join("");
	}

/*
Бонус: Микро торрент

Если в универсальном магните есть sha1 хеш используя его мы можем сгенерировать микро торрент файл. Это торрент в котором только одна чась которая включает весь файл. Sha1 хеш этой части совпадает в Sha1 хешем самого файла. Этот торрент можно получить из магнита что позволяет шарить в сети BitTorrent небольшие файлы без необходимости создания полноценного торрент файла. Также микро торрентом можно передать через сеть BitTorrent большой торрент файл полностью а не только info часть.
*/ 
	
	
/* Функция подсчёта длины строки */
	function raw_length(encodedURI){
		var count = 0;
		var index = 0;
		for (index = encodedURI.indexOf("%"); index>=0 && (++count) ; index = encodedURI.indexOf("%", index+1));
		return encodedURI.length-count*2;
	}
	
/* Добавляем bencode кодированную строку */
	function push_string(string, to_list){
		to_list.push(raw_length(string));
		to_list.push(":");
		to_list.push(string);
	}

/*
Функция сборки микро торрент файла.


Для того чтобы собрать его нам нужены: sha1 хеш файла, размер файла, имя файла. Параметры в info части микро торрента записываются в алфавитном порядке по имени параметра. Это уменьшает вариативность сборки торрент файла и увеличивает вероятность получения того же btih из того же магнита. У uTorrent есть ограничение на минимальный размер части поэтому если файл меньше 16384 байт размер части устанавливается равным этому числу.

Пример:
data:application/x-bittorrent;,d4:infod6:lengthi10826029e4:name23:mediawiki-1.15.1.tar.gz12:piece%20lengthi10826029e6:pieces20:%bc%6f%a7%90%b7%73%88%92%c6%b4%15%fc%76%65%8a%97%67%63%71%5de8:url-listl68:http%3A%2F%2Fdownload.wikimedia.org%2Fmediawiki%2F1.15%2Fmediawiki-1.15.1.tar.gzee

*/
	function make_micro_torrent(file){
		if (file.name && file.size && file.hash && file.hash.sha1){
			var torrent = ["data:application/x-bittorrent;,d"];
			if (file.trackers && file.trackers.length>0){
				torrent.push("8:announce");
				push_string(file.trackers[0], torrent);
				if (file.trackers.length>1){
					torrent.push("13:announce-listl");
					for (var i = 1; file.trackers.length>i; i++){
						var tracker = encodeURIComponent(decodeURIComponent(file.trackers[i]));
						push_string(tracker, torrent);
					}
					torrent.push("e");
				}
			}
			torrent.push("4:infod");
			torrent.push("6:length");
			torrent.push("i");
			torrent.push(file.size);
			torrent.push("e");
			torrent.push("4:name");
			var name = encodeURIComponent(file.name);
			push_string(name, torrent);
			torrent.push("12:piece%20length");
			torrent.push("i");
			torrent.push(file.size < 16384 ? 16384 : file.size);
			torrent.push("e");
			torrent.push("6:pieces");
			var sha1 = file.hash.sha1;
			if (sha1.length < 40)
				sha1 = base32_to_hex(sha1);
			sha1 = sha1.replace(/[0-9A-Fa-f]{2}/g,"%$&");
			push_string(sha1, torrent);
			torrent.push("e");
			if (file.url && file.url.length>0){
				torrent.push("8:url-listl");
				for (var i = 0; file.url.length>i; i++){
					var url = encodeURIComponent(decodeURIComponent(file.url[i]));
					push_string(url, torrent);
				}
				torrent.push("e");
			}
			torrent.push("e");
			return torrent.join("");
		}
	}



/*
Функция для вставки новых ссылок на страницу.
*/


	function insert_link_after(sibling, href, class_name){
		var new_link = document.createElement("A");
		if (href) new_link.href = href;
		if (class_name) new_link.className = class_name;
		return sibling.parentNode.insertBefore(new_link, sibling.nextSibling);
	}


/*
Поехали


Перебираем ссылки и ищем в них магниты. Ссылки перебираются в обратном порядке так как мы добавляем новые и массив ссылок автоматом увеличивается. Сейчас не проверял но раньше я на этом в бесконечный цикл попадал.
*/
	var links = document.getElementsByTagName("A");
	for (var i = links.length - 1; i >= 0; i--){
		var link = links[i];
		var magnet_index = link.href.indexOf("magnet:?");
		var magnet_link;
		
		if (magnet_index < 0){
			magnet_index = link.href.indexOf("magnet%3A%3F");
			if( magnet_index > -1 )
				magnet_link = try_decode(link.href.substr(magnet_index));
		}
		else 
			magnet_link = link.href.substr(magnet_index);
		
		if (magnet_index > -1){
			var file = parse_magnet(magnet_link);
			if ( file.name ){
				var spliter = "/" + file.name + "#magnet";
				if ( link.href.indexOf( spliter ) > -1 ){
					/*
					URL + magnet
					Добавляем прямую ссылку на файл.
					*/
					
					if (!file.url) file.url = [];
					file.url.push(link.href.split( spliter )[0] + "/" + file.name);
				}
			}
			
			var link_functions = {
				"micro-torrent": make_micro_torrent, 
				"torrent-magnet":torrent_magnet, 
				"dc-magnet": dc_magnet, 
				"ed2k-link": ed2k_link, 
				"full-magnet": full_magnet};
			
			for (var name in link_functions){
				var href = link_functions[name](file);
				if (href){
					var a = insert_link_after(link, href, name);
					if ( name == "micro-torrent" ){
						/* Используем атрибут download для того чтоб задать имя торрент файла. */
						a.setAttribute("download", (file.name) + ".micro.torrent");
					}
						
				}
					
			}
		}
	}
	
/* Текст ссылкам зададим через стили. Так же можно и картинки вписать в виде Data URI. */

	document.head.appendChild(document.createElement('style')).appendChild(document.createTextNode(`
		[class*='-magnet'], .ed2k-link, .micro-torrent{
			margin-left: 1em
		}
		a[class*='-magnet']:before, .ed2k-link:before, .micro-torrent:before{
			content: attr(class)
		}`))
})();
void(0);
