/*
 Copyright (c) 2010-2012, CloudMade, Vladimir Agafonkin
 Leaflet is a modern open-source JavaScript library for interactive maps.
 http://leaflet.cloudmade.com
*/

(function (root) {
	root.L = {
		VERSION: '0.4',

		ROOT_URL: root.L_ROOT_URL || (function () {
			var scripts = document.getElementsByTagName('script'),
			    leafletRe = /\/?leaflet[\-\._]?([\w\-\._]*)\.js\??/;

			var i, len, src, matches;

			for (i = 0, len = scripts.length; i < len; i++) {
				src = scripts[i].src;
				matches = src.match(leafletRe);

				if (matches) {
					if (matches[1] === 'include') {
						return '../../dist/';
					}
					return src.split(leafletRe)[0] + '/';
				}
			}

			return '';
		}()),

		noConflict: function () {
			root.L = this._originalL;
			return this;
		},

		_originalL: root.L
	};
}(this));


/*
 * L.Util is a namespace for various utility functions.
 */

L.Util = {
	extend: function (/*Object*/ dest) /*-> Object*/ {	// merge src properties into dest
		var sources = Array.prototype.slice.call(arguments, 1);
		for (var j = 0, len = sources.length, src; j < len; j++) {
			src = sources[j] || {};
			for (var i in src) {
				if (src.hasOwnProperty(i)) {
					dest[i] = src[i];
				}
			}
		}
		return dest;
	},

	bind: function (/*Function*/ fn, /*Object*/ obj) /*-> Object*/ {
		return function () {
			return fn.apply(obj, arguments);
		};
	},

	stamp: (function () {
		var lastId = 0, key = '_leaflet_id';
		return function (/*Object*/ obj) {
			obj[key] = obj[key] || ++lastId;
			return obj[key];
		};
	}()),


	// TODO refactor: remove repetition

	requestAnimFrame: (function () {
		function timeoutDefer(callback) {
			window.setTimeout(callback, 1000 / 60);
		}

		var requestFn = window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame ||
			window.oRequestAnimationFrame ||
			window.msRequestAnimationFrame ||
			timeoutDefer;

		return function (callback, context, immediate, contextEl) {
			callback = context ? L.Util.bind(callback, context) : callback;
			if (immediate && requestFn === timeoutDefer) {
				callback();
			} else {
				return requestFn.call(window, callback, contextEl);
			}
		};
	}()),

	cancelAnimFrame: (function () {
		var requestFn = window.cancelAnimationFrame ||
			window.webkitCancelRequestAnimationFrame ||
			window.mozCancelRequestAnimationFrame ||
			window.oCancelRequestAnimationFrame ||
			window.msCancelRequestAnimationFrame ||
			clearTimeout;

		return function (handle) {
			if (!handle) { return; }
			return requestFn.call(window, handle);
		};
	}()),

	limitExecByInterval: function (fn, time, context) {
		var lock, execOnUnlock, args;
		function exec() {
			lock = false;
			if (execOnUnlock) {
				args.callee.apply(context, args);
				execOnUnlock = false;
			}
		}
		return function () {
			args = arguments;
			if (!lock) {
				lock = true;
				setTimeout(exec, time);
				fn.apply(context, args);
			} else {
				execOnUnlock = true;
			}
		};
	},

	falseFn: function () {
		return false;
	},

	formatNum: function (num, digits) {
		var pow = Math.pow(10, digits || 5);
		return Math.round(num * pow) / pow;
	},

	setOptions: function (obj, options) {
		obj.options = L.Util.extend({}, obj.options, options);
	},

	getParamString: function (obj) {
		var params = [];
		for (var i in obj) {
			if (obj.hasOwnProperty(i)) {
				params.push(i + '=' + obj[i]);
			}
		}
		return '?' + params.join('&');
	},

	template: function (str, data) {
		return str.replace(/\{ *([\w_]+) *\}/g, function (str, key) {
			var value = data[key];
			if (!data.hasOwnProperty(key)) {
				throw new Error('No value provided for variable ' + str);
			}
			return value;
		});
	},

	emptyImageUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
};


/*
 * Class powers the OOP facilities of the library. Thanks to John Resig and Dean Edwards for inspiration!
 */

L.Class = function () {};

L.Class.extend = function (/*Object*/ props) /*-> Class*/ {

	// extended class with the new prototype
	var NewClass = function () {
		if (this.initialize) {
			this.initialize.apply(this, arguments);
		}
	};

	// instantiate class without calling constructor
	var F = function () {};
	F.prototype = this.prototype;
	var proto = new F();

	proto.constructor = NewClass;
	NewClass.prototype = proto;

	// add superclass access
	NewClass.superclass = this.prototype;

	// add class name
	//proto.className = props;

	//inherit parent's statics
	for (var i in this) {
		if (this.hasOwnProperty(i) && i !== 'prototype' && i !== 'superclass') {
			NewClass[i] = this[i];
		}
	}

	// mix static properties into the class
	if (props.statics) {
		L.Util.extend(NewClass, props.statics);
		delete props.statics;
	}

	// mix includes into the prototype
	if (props.includes) {
		L.Util.extend.apply(null, [proto].concat(props.includes));
		delete props.includes;
	}

	// merge options
	if (props.options && proto.options) {
		props.options = L.Util.extend({}, proto.options, props.options);
	}

	// mix given properties into the prototype
	L.Util.extend(proto, props);

	// allow inheriting further
	NewClass.extend = L.Class.extend;

	// method for adding properties to prototype
	NewClass.include = function (props) {
		L.Util.extend(this.prototype, props);
	};

	return NewClass;
};


/*
 * L.Mixin.Events adds custom events functionality to Leaflet classes
 */

L.Mixin = {};

L.Mixin.Events = {
	addEventListener: function (/*String*/ type, /*Function*/ fn, /*(optional) Object*/ context) {
		var events = this._leaflet_events = this._leaflet_events || {};
		events[type] = events[type] || [];
		events[type].push({
			action: fn,
			context: context || this
		});
		return this;
	},

	hasEventListeners: function (/*String*/ type) /*-> Boolean*/ {
		var k = '_leaflet_events';
		return (k in this) && (type in this[k]) && (this[k][type].length > 0);
	},

	removeEventListener: function (/*String*/ type, /*Function*/ fn, /*(optional) Object*/ context) {
		if (!this.hasEventListeners(type)) {
			return this;
		}

		for (var i = 0, events = this._leaflet_events, len = events[type].length; i < len; i++) {
			if (
				(events[type][i].action === fn) &&
				(!context || (events[type][i].context === context))
			) {
				events[type].splice(i, 1);
				return this;
			}
		}
		return this;
	},

	fireEvent: function (/*String*/ type, /*(optional) Object*/ data) {
		if (!this.hasEventListeners(type)) {
			return this;
		}

		var event = L.Util.extend({
			type: type,
			target: this
		}, data);

		var listeners = this._leaflet_events[type].slice();

		for (var i = 0, len = listeners.length; i < len; i++) {
			listeners[i].action.call(listeners[i].context || this, event);
		}

		return this;
	}
};

L.Mixin.Events.on = L.Mixin.Events.addEventListener;
L.Mixin.Events.off = L.Mixin.Events.removeEventListener;
L.Mixin.Events.fire = L.Mixin.Events.fireEvent;


(function () {
	var ua = navigator.userAgent.toLowerCase(),
		ie = !!window.ActiveXObject,
		webkit = ua.indexOf("webkit") !== -1,
		mobile = typeof orientation !== 'undefined' ? true : false,
		android = ua.indexOf("android") !== -1,
		opera = window.opera;

	L.Browser = {
		ie: ie,
		ie6: ie && !window.XMLHttpRequest,

		webkit: webkit,
		webkit3d: webkit && ('WebKitCSSMatrix' in window) && ('m11' in new window.WebKitCSSMatrix()),

		gecko: false, // ua.indexOf("gecko") !== -1,

		opera: opera,

		android: android,
		mobileWebkit: mobile && webkit,
		mobileOpera: mobile && opera,

		mobile: mobile,
		touch: (function () {
			var touchSupported = false,
				startName = 'ontouchstart';

			// WebKit, etc
			if (startName in document.documentElement) {
				return true;
			}

			// Firefox/Gecko
			var e = document.createElement('div');

			// If no support for basic event stuff, unlikely to have touch support
			if (!e.setAttribute || !e.removeAttribute) {
				return false;
			}

			e.setAttribute(startName, 'return;');
			if (typeof e[startName] === 'function') {
				touchSupported = true;
			}

			e.removeAttribute(startName);
			e = null;

			return touchSupported;
		}())
	};
}());


/*
 * L.Point represents a point with x and y coordinates.
 */

L.Point = function (/*Number*/ x, /*Number*/ y, /*Boolean*/ round) {
	this.x = (round ? Math.round(x) : x);
	this.y = (round ? Math.round(y) : y);
};

L.Point.prototype = {
	add: function (point) {
		return this.clone()._add(point);
	},

	_add: function (point) {
		this.x += point.x;
		this.y += point.y;
		return this;
	},

	subtract: function (point) {
		return this.clone()._subtract(point);
	},

	// destructive subtract (faster)
	_subtract: function (point) {
		this.x -= point.x;
		this.y -= point.y;
		return this;
	},

	divideBy: function (num, round) {
		return new L.Point(this.x / num, this.y / num, round);
	},

	multiplyBy: function (num) {
        if (typeof num === 'number') {
            return new L.Point(this.x * num, this.y * num);
        }
        else {
            return new L.Point(this.x * num.x, this.y * num.y);
        }
	},

	distanceTo: function (point) {
		var x = point.x - this.x,
			y = point.y - this.y;
		return Math.sqrt(x * x + y * y);
	},

	round: function () {
		return this.clone()._round();
	},

	// destructive round
	_round: function () {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		return this;
	},

	clone: function () {
		return new L.Point(this.x, this.y);
	},

	toString: function () {
		return 'Point(' +
				L.Util.formatNum(this.x) + ', ' +
				L.Util.formatNum(this.y) + ')';
	}
};


/*
 * L.Bounds represents a rectangular area on the screen in pixel coordinates.
 */

L.Bounds = L.Class.extend({
	initialize: function (min, max) {	//(Point, Point) or Point[]
		if (!min) {
			return;
		}
		var points = (min instanceof Array ? min : [min, max]);
		for (var i = 0, len = points.length; i < len; i++) {
			this.extend(points[i]);
		}
	},

	// extend the bounds to contain the given point
	extend: function (/*Point*/ point) {
		if (!this.min && !this.max) {
			this.min = new L.Point(point.x, point.y);
			this.max = new L.Point(point.x, point.y);
		} else {
			this.min.x = Math.min(point.x, this.min.x);
			this.max.x = Math.max(point.x, this.max.x);
			this.min.y = Math.min(point.y, this.min.y);
			this.max.y = Math.max(point.y, this.max.y);
		}
	},

	getCenter: function (round)/*->Point*/ {
		return new L.Point(
				(this.min.x + this.max.x) / 2,
				(this.min.y + this.max.y) / 2, round);
	},

	contains: function (/*Bounds or Point*/ obj)/*->Boolean*/ {
		var min, max;

		if (obj instanceof L.Bounds) {
			min = obj.min;
			max = obj.max;
		} else {
			min = max = obj;
		}

		return (min.x >= this.min.x) &&
				(max.x <= this.max.x) &&
				(min.y >= this.min.y) &&
				(max.y <= this.max.y);
	},

	intersects: function (/*Bounds*/ bounds) {
		var min = this.min,
			max = this.max,
			min2 = bounds.min,
			max2 = bounds.max;

		var xIntersects = (max2.x >= min.x) && (min2.x <= max.x),
			yIntersects = (max2.y >= min.y) && (min2.y <= max.y);

		return xIntersects && yIntersects;
	}

});


/*
 * L.Transformation is an utility class to perform simple point transformations through a 2d-matrix.
 */

L.Transformation = L.Class.extend({
	initialize: function (/*Number*/ a, /*Number*/ b, /*Number*/ c, /*Number*/ d) {
		this._a = a;
		this._b = b;
		this._c = c;
		this._d = d;
	},

	transform: function (point, scale) {
		return this._transform(point.clone(), scale);
	},

	// destructive transform (faster)
	_transform: function (/*Point*/ point, /*Number*/ scale) /*-> Point*/ {
		scale = scale || 1;
		point.x = scale * (this._a * point.x + this._b);
		point.y = scale * (this._c * point.y + this._d);
		return point;
	},

	untransform: function (/*Point*/ point, /*Number*/ scale) /*-> Point*/ {
		scale = scale || 1;
		return new L.Point(
			(point.x / scale - this._b) / this._a,
			(point.y / scale - this._d) / this._c);
	}
});


/*
 * L.DomUtil contains various utility functions for working with DOM
 */

L.DomUtil = {
	get: function (id) {
		return (typeof id === 'string' ? document.getElementById(id) : id);
	},

	getStyle: function (el, style) {
		var value = el.style[style];
		if (!value && el.currentStyle) {
			value = el.currentStyle[style];
		}
		if (!value || value === 'auto') {
			var css = document.defaultView.getComputedStyle(el, null);
			value = css ? css[style] : null;
		}
		return (value === 'auto' ? null : value);
	},

	getViewportOffset: function (element) {
		var top = 0,
			left = 0,
			el = element,
			docBody = document.body;

		do {
			top += el.offsetTop || 0;
			left += el.offsetLeft || 0;

			if (el.offsetParent === docBody &&
					L.DomUtil.getStyle(el, 'position') === 'absolute') {
				break;
			}
			el = el.offsetParent;
		} while (el);

		el = element;

		do {
			if (el === docBody) {
				break;
			}

			top -= el.scrollTop || 0;
			left -= el.scrollLeft || 0;

			el = el.parentNode;
		} while (el);

		return new L.Point(left, top);
	},

	create: function (tagName, className, container) {
		var el = document.createElement(tagName);
		el.className = className;
		if (container) {
			container.appendChild(el);
		}
		return el;
	},

	disableTextSelection: function () {
		if (document.selection && document.selection.empty) {
			document.selection.empty();
		}
		if (!this._onselectstart) {
			this._onselectstart = document.onselectstart;
			document.onselectstart = L.Util.falseFn;
		}
	},

	enableTextSelection: function () {
		document.onselectstart = this._onselectstart;
		this._onselectstart = null;
	},

	hasClass: function (el, name) {
		return (el.className.length > 0) &&
				new RegExp("(^|\\s)" + name + "(\\s|$)").test(el.className);
	},

	addClass: function (el, name) {
		if (!L.DomUtil.hasClass(el, name)) {
			el.className += (el.className ? ' ' : '') + name;
		}
	},

	removeClass: function (el, name) {
		el.className = el.className.replace(/(\S+)\s*/g, function (w, match) {
			if (match === name) {
				return '';
			}
			return w;
		}).replace(/^\s+/, '');
	},

	setOpacity: function (el, value) {
		if (L.Browser.ie) {
			el.style.filter = 'alpha(opacity=' + Math.round(value * 100) + ')';
		} else {
			el.style.opacity = value;
		}
	},

	//TODO refactor away this ugly translate/position mess

	testProp: function (props) {
		var style = document.documentElement.style;

		for (var i = 0; i < props.length; i++) {
			if (props[i] in style) {
				return props[i];
			}
		}
		return false;
	},

	getTranslateString: function (point) {
		return L.DomUtil.TRANSLATE_OPEN +
				point.x + 'px,' + point.y + 'px' +
				L.DomUtil.TRANSLATE_CLOSE;
	},

	getScaleString: function (scale, origin) {
		var preTranslateStr = L.DomUtil.getTranslateString(origin),
			scaleStr = ' scale(' + scale + ') ',
			postTranslateStr = L.DomUtil.getTranslateString(origin.multiplyBy(-1));

		return preTranslateStr + scaleStr + postTranslateStr;
	},

	setPosition: function (el, point) {
		el._leaflet_pos = point;
		if (L.Browser.webkit3d) {
			el.style[L.DomUtil.TRANSFORM] =  L.DomUtil.getTranslateString(point);
			el.style['-webkit-backface-visibility'] = 'hidden';
		} else {
			el.style.left = point.x + 'px';
			el.style.top = point.y + 'px';
		}
	},

	getPosition: function (el) {
		return el._leaflet_pos;
	}
};

L.Util.extend(L.DomUtil, {
	TRANSITION: L.DomUtil.testProp(['transition', 'webkitTransition', 'OTransition', 'MozTransition', 'msTransition']),
	TRANSFORM: L.DomUtil.testProp(['transformProperty', 'WebkitTransform', 'OTransform', 'MozTransform', 'msTransform']),

	TRANSLATE_OPEN: 'translate' + (L.Browser.webkit3d ? '3d(' : '('),
	TRANSLATE_CLOSE: L.Browser.webkit3d ? ',0)' : ')'
});


/*
	CM.LatLng represents a geographical point with latitude and longtitude coordinates.
*/

L.LatLng = function (/*Number*/ rawLat, /*Number*/ rawLng, /*Boolean*/ noWrap) {
	var lat = parseFloat(rawLat),
		lng = parseFloat(rawLng);

	if (isNaN(lat) || isNaN(lng)) {
		throw new Error('Invalid LatLng object: (' + rawLat + ', ' + rawLng + ')');
	}

	if (noWrap !== true) {
		lat = Math.max(Math.min(lat, 90), -90);					// clamp latitude into -90..90
		lng = (lng + 180) % 360 + ((lng < -180 || lng === 180) ? 180 : -180);	// wrap longtitude into -180..180
	}

	//TODO change to lat() & lng()
	this.lat = lat;
	this.lng = lng;
};

L.Util.extend(L.LatLng, {
	DEG_TO_RAD: Math.PI / 180,
	RAD_TO_DEG: 180 / Math.PI,
	MAX_MARGIN: 1.0E-9 // max margin of error for the "equals" check
});

L.LatLng.prototype = {
	equals: function (/*LatLng*/ obj) {
		if (!(obj instanceof L.LatLng)) {
			return false;
		}

		var margin = Math.max(Math.abs(this.lat - obj.lat), Math.abs(this.lng - obj.lng));
		return margin <= L.LatLng.MAX_MARGIN;
	},

	toString: function () {
		return 'LatLng(' +
				L.Util.formatNum(this.lat) + ', ' +
				L.Util.formatNum(this.lng) + ')';
	},

	// Haversine distance formula, see http://en.wikipedia.org/wiki/Haversine_formula
	distanceTo: function (/*LatLng*/ other)/*->Double*/ {
		var R = 6378137, // earth radius in meters
			d2r = L.LatLng.DEG_TO_RAD,
			dLat = (other.lat - this.lat) * d2r,
			dLon = (other.lng - this.lng) * d2r,
			lat1 = this.lat * d2r,
			lat2 = other.lat * d2r,
			sin1 = Math.sin(dLat / 2),
			sin2 = Math.sin(dLon / 2);

		var a = sin1 * sin1 + sin2 * sin2 * Math.cos(lat1) * Math.cos(lat2);

		return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	}
};


/*
 * L.LatLngBounds represents a rectangular area on the map in geographical coordinates.
 */

L.LatLngBounds = L.Class.extend({
	initialize: function (southWest, northEast) {	// (LatLng, LatLng) or (LatLng[])
		if (!southWest) {
			return;
		}
		var latlngs = (southWest instanceof Array ? southWest : [southWest, northEast]);
		for (var i = 0, len = latlngs.length; i < len; i++) {
			this.extend(latlngs[i]);
		}
	},

	// extend the bounds to contain the given point
	extend: function (/*LatLng*/ latlng) {
		if (!this._southWest && !this._northEast) {
			this._southWest = new L.LatLng(latlng.lat, latlng.lng, true);
			this._northEast = new L.LatLng(latlng.lat, latlng.lng, true);
		} else {
			this._southWest.lat = Math.min(latlng.lat, this._southWest.lat);
			this._southWest.lng = Math.min(latlng.lng, this._southWest.lng);
			this._northEast.lat = Math.max(latlng.lat, this._northEast.lat);
			this._northEast.lng = Math.max(latlng.lng, this._northEast.lng);
		}
		return this;
	},

	// extend the bounds by a percentage
	pad: function (bufferRatio) { // (Number) -> LatLngBounds
		var sw = this._southWest,
			ne = this._northEast,
			heightBuffer = Math.abs(sw.lat - ne.lat) * bufferRatio,
			widthBuffer = Math.abs(sw.lng - ne.lng) * bufferRatio;

		return new L.LatLngBounds(
			new L.LatLng(sw.lat - heightBuffer, sw.lng - widthBuffer),
			new L.LatLng(ne.lat + heightBuffer, ne.lng + widthBuffer));
	},

	getCenter: function () /*-> LatLng*/ {
		return new L.LatLng(
				(this._southWest.lat + this._northEast.lat) / 2,
				(this._southWest.lng + this._northEast.lng) / 2);
	},

	getSouthWest: function () {
		return this._southWest;
	},

	getNorthEast: function () {
		return this._northEast;
	},

	getNorthWest: function () {
		return new L.LatLng(this._northEast.lat, this._southWest.lng, true);
	},

	getSouthEast: function () {
		return new L.LatLng(this._southWest.lat, this._northEast.lng, true);
	},

	contains: function (/*LatLngBounds or LatLng*/ obj) /*-> Boolean*/ {
		var sw = this._southWest,
			ne = this._northEast,
			sw2, ne2;

		if (obj instanceof L.LatLngBounds) {
			sw2 = obj.getSouthWest();
			ne2 = obj.getNorthEast();
		} else {
			sw2 = ne2 = obj;
		}

		return (sw2.lat >= sw.lat) && (ne2.lat <= ne.lat) &&
				(sw2.lng >= sw.lng) && (ne2.lng <= ne.lng);
	},

	intersects: function (/*LatLngBounds*/ bounds) {
		var sw = this._southWest,
			ne = this._northEast,
			sw2 = bounds.getSouthWest(),
			ne2 = bounds.getNorthEast();

		var latIntersects = (ne2.lat >= sw.lat) && (sw2.lat <= ne.lat),
			lngIntersects = (ne2.lng >= sw.lng) && (sw2.lng <= ne.lng);

		return latIntersects && lngIntersects;
	},

	toBBoxString: function () {
		var sw = this._southWest,
			ne = this._northEast;
		return [sw.lng, sw.lat, ne.lng, ne.lat].join(',');
	},

	equals: function (/*LatLngBounds*/ bounds) {
		return bounds ? this._southWest.equals(bounds.getSouthWest()) &&
		                this._northEast.equals(bounds.getNorthEast()) : false;
	}
});

//TODO International date line?


/*
 * L.Projection contains various geographical projections used by CRS classes.
 */

L.Projection = {};



L.Projection.SphericalMercator = {
	MAX_LATITUDE: 85.0511287798,

	project: function (/*LatLng*/ latlng) /*-> Point*/ {
		var d = L.LatLng.DEG_TO_RAD,
			max = this.MAX_LATITUDE,
			lat = Math.max(Math.min(max, latlng.lat), -max),
			x = latlng.lng * d,
			y = lat * d;
		y = Math.log(Math.tan((Math.PI / 4) + (y / 2)));

		return new L.Point(x, y);
	},

	unproject: function (/*Point*/ point, /*Boolean*/ unbounded) /*-> LatLng*/ {
		var d = L.LatLng.RAD_TO_DEG,
			lng = point.x * d,
			lat = (2 * Math.atan(Math.exp(point.y)) - (Math.PI / 2)) * d;

		return new L.LatLng(lat, lng, unbounded);
	}
};



L.Projection.LonLat = {
	project: function (latlng) {
		return new L.Point(latlng.lng, latlng.lat);
	},

	unproject: function (point, unbounded) {
		return new L.LatLng(point.y, point.x, unbounded);
	}
};



L.CRS = {
	latLngToPoint: function (/*LatLng*/ latlng, /*Number*/ scale)/*-> Point*/ {
		var projectedPoint = this.projection.project(latlng);
		return this.transformation._transform(projectedPoint, scale);
	},

	pointToLatLng: function (/*Point*/ point, /*Number*/ scale, /*(optional) Boolean*/ unbounded)/*-> LatLng*/ {
		var untransformedPoint = this.transformation.untransform(point, scale);
		return this.projection.unproject(untransformedPoint, unbounded);
		//TODO get rid of 'unbounded' everywhere
	},

	project: function (latlng) {
		return this.projection.project(latlng);
	}
};



L.CRS.EPSG3857 = L.Util.extend({}, L.CRS, {
	code: 'EPSG:3857',

	projection: L.Projection.SphericalMercator,
	transformation: new L.Transformation(0.5 / Math.PI, 0.5, -0.5 / Math.PI, 0.5),

	project: function (/*LatLng*/ latlng)/*-> Point*/ {
		var projectedPoint = this.projection.project(latlng),
			earthRadius = 6378137;
		return projectedPoint.multiplyBy(earthRadius);
	}
});

L.CRS.EPSG900913 = L.Util.extend({}, L.CRS.EPSG3857, {
	code: 'EPSG:900913'
});



L.CRS.EPSG4326 = L.Util.extend({}, L.CRS, {
	code: 'EPSG:4326',

	projection: L.Projection.LonLat,
	transformation: new L.Transformation(1 / 360, 0.5, -1 / 360, 0.5)
});


/*
 * L.Map is the central class of the API - it is used to create a map.
 */

L.Map = L.Class.extend({
	includes: L.Mixin.Events,

	options: {
		// projection
		crs: L.CRS.EPSG3857 || L.CRS.EPSG4326,
		scale: function (zoom) {
			return 256 * Math.pow(2, zoom);
		},

		// state
		center: null,
		zoom: null,
		layers: [],

		// interaction
		dragging: true,
		touchZoom: L.Browser.touch && !L.Browser.android,
		scrollWheelZoom: !L.Browser.touch,
		doubleClickZoom: true,
		boxZoom: true,

		inertia: !L.Browser.android,
		inertiaDeceleration: L.Browser.touch ? 3000 : 2000, // px/s^2
		inertiaMaxSpeed:      L.Browser.touch ? 1500 : 1000, // px/s
		inertiaThreshold:      L.Browser.touch ? 32   : 16, // ms

		// controls
		zoomControl: true,
		attributionControl: true,

		// animation
		fadeAnimation: L.DomUtil.TRANSITION && !L.Browser.android,
		zoomAnimation: L.DomUtil.TRANSITION && !L.Browser.android && !L.Browser.mobileOpera,

		// misc
		trackResize: true,
		closePopupOnClick: true,
		worldCopyJump: true
	},


	initialize: function (id, options) { // (HTMLElement or String, Object)
		L.Util.setOptions(this, options);

		// TODO method is too big, refactor

		var container = this._container = L.DomUtil.get(id);

		if (container._leaflet) {
			throw new Error("Map container is already initialized.");
		}
		container._leaflet = true;

		this._initLayout();

		if (L.DomEvent) {
			this._initEvents();
			if (L.Handler) {
				this._initInteraction();
			}
			if (L.Control) {
				this._initControls();
			}
		}

		options = this.options;

		if (options.maxBounds) {
			this.setMaxBounds(options.maxBounds);
		}

		var center = options.center,
		    zoom = options.zoom;

		if (center && typeof zoom !== 'undefined') {
			this.setView(center, zoom, true);
		}

		this._initLayers(options.layers);
	},


	// public methods that modify map state

	// replaced by animation-powered implementation in Map.PanAnimation.js
	setView: function (center, zoom) {
		// reset the map view
		this._resetView(center, this._limitZoom(zoom));
		return this;
	},

	setZoom: function (zoom) { // (Number)
		return this.setView(this.getCenter(), zoom);
	},

	zoomIn: function () {
		return this.setZoom(this._zoom + 1);
	},

	zoomOut: function () {
		return this.setZoom(this._zoom - 1);
	},

	fitBounds: function (bounds) { // (LatLngBounds)
		var zoom = this.getBoundsZoom(bounds);
		return this.setView(bounds.getCenter(), zoom);
	},

	fitWorld: function () {
		var sw = new L.LatLng(-60, -170),
		    ne = new L.LatLng(85, 179);

		return this.fitBounds(new L.LatLngBounds(sw, ne));
	},

	panTo: function (center) { // (LatLng)
		return this.setView(center, this._zoom);
	},

	panBy: function (offset) { // (Point)
		// replaced with animated panBy in Map.Animation.js
		this.fire('movestart');

		this._rawPanBy(offset);

		this.fire('move');
		return this.fire('moveend');
	},

	setMaxBounds: function (bounds) {
		this.options.maxBounds = bounds;

		if (!bounds) {
			this._boundsMinZoom = null;
			return this;
		}

		var minZoom = this.getBoundsZoom(bounds, true);

		this._boundsMinZoom = minZoom;

		if (this._loaded) {
			if (this._zoom < minZoom) {
				this.setView(bounds.getCenter(), minZoom);
			} else {
				this.panInsideBounds(bounds);
			}
		}

		return this;
	},

	panInsideBounds: function (bounds) {
		var viewBounds = this.getBounds(),
		    viewSw = this.project(viewBounds.getSouthWest()),
		    viewNe = this.project(viewBounds.getNorthEast()),
		    sw = this.project(bounds.getSouthWest()),
		    ne = this.project(bounds.getNorthEast()),
		    dx = 0,
		    dy = 0;

		if (viewNe.y < ne.y) { // north
			dy = ne.y - viewNe.y;
		}
		if (viewNe.x > ne.x) { // east
			dx = ne.x - viewNe.x;
		}
		if (viewSw.y > sw.y) { // south
			dy = sw.y - viewSw.y;
		}
		if (viewSw.x < sw.x) { // west
			dx = sw.x - viewSw.x;
		}

		return this.panBy(new L.Point(dx, dy, true));
	},

	addLayer: function (layer, insertAtTheBottom) {
		// TODO method is too big, refactor

		var id = L.Util.stamp(layer);

		if (this._layers[id]) {
			return this;
		}

		this._layers[id] = layer;

		// TODO getMaxZoom, getMinZoom in ILayer (instead of options)
		if (layer.options && !isNaN(layer.options.maxZoom)) {
			this._layersMaxZoom = Math.max(this._layersMaxZoom || 0, layer.options.maxZoom);
		}
		if (layer.options && !isNaN(layer.options.minZoom)) {
			this._layersMinZoom = Math.min(this._layersMinZoom || Infinity, layer.options.minZoom);
		}

		// TODO looks ugly, refactor!!!
		if (this.options.zoomAnimation && L.TileLayer && (layer instanceof L.TileLayer)) {
			this._tileLayersNum++;
			layer.on('load', this._onTileLayerLoad, this);
		}

		if (this.attributionControl && layer.getAttribution) {
			this.attributionControl.addAttribution(layer.getAttribution());
		}

		var onMapLoad = function () {
			layer.onAdd(this, insertAtTheBottom);
			this.fire('layeradd', {layer: layer});
		};

		if (this._loaded) {
			onMapLoad.call(this);
		} else {
			this.on('load', onMapLoad, this);
		}

		return this;
	},

	removeLayer: function (layer) {
		var id = L.Util.stamp(layer);

		if (!this._layers[id]) { return; }

		layer.onRemove(this);

		delete this._layers[id];

		// TODO looks ugly, refactor
		if (this.options.zoomAnimation && L.TileLayer && (layer instanceof L.TileLayer)) {
			this._tileLayersNum--;
			layer.off('load', this._onTileLayerLoad, this);
		}

		if (this.attributionControl && layer.getAttribution) {
			this.attributionControl.removeAttribution(layer.getAttribution());
		}

		return this.fire('layerremove', {layer: layer});
	},

	hasLayer: function (layer) {
		var id = L.Util.stamp(layer);
		return this._layers.hasOwnProperty(id);
	},

	invalidateSize: function () {
		var oldSize = this.getSize();

		this._sizeChanged = true;

		if (this.options.maxBounds) {
			this.setMaxBounds(this.options.maxBounds);
		}

		if (!this._loaded) { return this; }

		var offset = oldSize.subtract(this.getSize()).divideBy(2, true);
		this._rawPanBy(offset);

		this.fire('move');

		function fireMoveEnd() {
			this.fire('moveend');
		}

		clearTimeout(this._sizeTimer);
		this._sizeTimer = setTimeout(L.Util.bind(fireMoveEnd, this), 200);

		return this;
	},

	addHandler: function (name, HandlerClass) {
		if (!HandlerClass) { return; }

		this[name] = new HandlerClass(this);

		if (this.options[name]) {
			this[name].enable();
		}

		return this;
	},


	// public methods for getting map state

	getCenter: function (unbounded) { // (Boolean)
		var viewHalf = this.getSize().divideBy(2),
		    centerPoint = this._getTopLeftPoint().add(viewHalf);

		return this.unproject(centerPoint, this._zoom, unbounded);
	},

	getZoom: function () {
		return this._zoom;
	},

	getBounds: function () {
		var bounds = this.getPixelBounds(),
		    sw = this.unproject(new L.Point(bounds.min.x, bounds.max.y), this._zoom, true),
		    ne = this.unproject(new L.Point(bounds.max.x, bounds.min.y), this._zoom, true);

		return new L.LatLngBounds(sw, ne);
	},

	getMinZoom: function () {
		var z1 = this.options.minZoom || 0,
		    z2 = this._layersMinZoom || 0,
		    z3 = this._boundsMinZoom || 0;

		return Math.max(z1, z2, z3);
	},

	getMaxZoom: function () {
		var z1 = typeof this.options.maxZoom === 'undefined' ? Infinity : this.options.maxZoom,
		    z2 = typeof this._layersMaxZoom  === 'undefined' ? Infinity : this._layersMaxZoom;

		return Math.min(z1, z2);
	},

	getBoundsZoom: function (bounds, inside) { // (LatLngBounds, Boolean) -> Number
		var size = this.getSize(),
		    zoom = this.options.minZoom || 0,
		    maxZoom = this.getMaxZoom(),
		    ne = bounds.getNorthEast(),
		    sw = bounds.getSouthWest(),
		    boundsSize,
		    nePoint,
		    swPoint,
		    zoomNotFound = true;

		if (inside) {
			zoom--;
		}

		do {
			zoom++;
			nePoint = this.project(ne, zoom);
			swPoint = this.project(sw, zoom);
			boundsSize = new L.Point(nePoint.x - swPoint.x, swPoint.y - nePoint.y);

			if (!inside) {
				zoomNotFound = boundsSize.x <= size.x && boundsSize.y <= size.y;
			} else {
				zoomNotFound = boundsSize.x < size.x || boundsSize.y < size.y;
			}
		} while (zoomNotFound && zoom <= maxZoom);

		if (zoomNotFound && inside) {
			return null;
		}

		return inside ? zoom : zoom - 1;
	},

	getSize: function () {
		if (!this._size || this._sizeChanged) {
			this._size = new L.Point(
				this._container.clientWidth,
				this._container.clientHeight);

			this._sizeChanged = false;
		}
		return this._size;
	},

	getPixelBounds: function () {
		var topLeftPoint = this._getTopLeftPoint();
		return new L.Bounds(topLeftPoint, topLeftPoint.add(this.getSize()));
	},

	getPixelOrigin: function () {
		return this._initialTopLeftPoint;
	},

	getPanes: function () {
		return this._panes;
	},


	// conversion methods

	mouseEventToContainerPoint: function (e) { // (MouseEvent)
		return L.DomEvent.getMousePosition(e, this._container);
	},

	mouseEventToLayerPoint: function (e) { // (MouseEvent)
		return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e));
	},

	mouseEventToLatLng: function (e) { // (MouseEvent)
		return this.layerPointToLatLng(this.mouseEventToLayerPoint(e));
	},

	containerPointToLayerPoint: function (point) { // (Point)
		return point.subtract(L.DomUtil.getPosition(this._mapPane));
	},

	layerPointToContainerPoint: function (point) { // (Point)
		return point.add(L.DomUtil.getPosition(this._mapPane));
	},

	layerPointToLatLng: function (point) { // (Point)
		return this.unproject(point.add(this._initialTopLeftPoint));
	},

	latLngToLayerPoint: function (latlng) { // (LatLng)
		return this.project(latlng)._round()._subtract(this._initialTopLeftPoint);
	},

	containerPointToLatLng: function (point) {
		return this.layerPointToLatLng(this.containerPointToLayerPoint(point));
	},

	latLngToContainerPoint: function (latlng) {
		return this.layerPointToContainerPoint(this.latLngToLayerPoint(latlng));
	},

	project: function (latlng, zoom) { // (LatLng[, Number]) -> Point
		zoom = typeof zoom === 'undefined' ? this._zoom : zoom;
		return this.options.crs.latLngToPoint(latlng, this.options.scale(zoom));
	},

	unproject: function (point, zoom, unbounded) { // (Point[, Number, Boolean]) -> LatLng
		// TODO remove unbounded, making it true all the time?
		zoom = typeof zoom === 'undefined' ? this._zoom : zoom;
		return this.options.crs.pointToLatLng(point, this.options.scale(zoom), unbounded);
	},


	// private methods that modify map state

	_initLayout: function () {
		var container = this._container;

		container.innerHTML = '';
		container.className += ' leaflet-container';

		if (L.Browser.touch) {
			container.className += ' leaflet-touch';
		}

		if (this.options.fadeAnimation) {
			container.className += ' leaflet-fade-anim';
		}

		var position = L.DomUtil.getStyle(container, 'position');

		if (position !== 'absolute' && position !== 'relative') {
			container.style.position = 'relative';
		}

		this._initPanes();

		if (this._initControlPos) {
			this._initControlPos();
		}
	},

	_initPanes: function () {
		var panes = this._panes = {};

		this._mapPane = panes.mapPane = this._createPane('leaflet-map-pane', this._container);

		this._tilePane = panes.tilePane = this._createPane('leaflet-tile-pane', this._mapPane);
		this._objectsPane = panes.objectsPane = this._createPane('leaflet-objects-pane', this._mapPane);

		panes.shadowPane = this._createPane('leaflet-shadow-pane');
		panes.overlayPane = this._createPane('leaflet-overlay-pane');
		panes.markerPane = this._createPane('leaflet-marker-pane');
		panes.popupPane = this._createPane('leaflet-popup-pane');
	},

	_createPane: function (className, container) {
		return L.DomUtil.create('div', className, container || this._objectsPane);
	},

	_resetView: function (center, zoom, preserveMapOffset, afterZoomAnim) {

		var zoomChanged = (this._zoom !== zoom);

		if (!afterZoomAnim) {
			this.fire('movestart');

			if (zoomChanged) {
				this.fire('zoomstart');
			}
		}

		this._zoom = zoom;

		this._initialTopLeftPoint = this._getNewTopLeftPoint(center);

		if (!preserveMapOffset) {
			L.DomUtil.setPosition(this._mapPane, new L.Point(0, 0));
		} else {
			this._initialTopLeftPoint._add(L.DomUtil.getPosition(this._mapPane));
		}

		this._tileLayersToLoad = this._tileLayersNum;

		this.fire('viewreset', {hard: !preserveMapOffset});

		this.fire('move');

		if (zoomChanged || afterZoomAnim) {
			this.fire('zoomend');
		}

		this.fire('moveend');

		if (!this._loaded) {
			this._loaded = true;
			this.fire('load');
		}
	},

	_initLayers: function (layers) {
		layers = layers instanceof Array ? layers : [layers];

		this._layers = {};
		this._tileLayersNum = 0;

		var i, len;

		for (i = 0, len = layers.length; i < len; i++) {
			this.addLayer(layers[i]);
		}
	},

	_initControls: function () {
		// TODO refactor, this should happen automatically
		if (this.options.zoomControl) {
			this.zoomControl = new L.Control.Zoom();
			this.addControl(this.zoomControl);
		}
		if (this.options.attributionControl) {
			this.attributionControl = new L.Control.Attribution();
			this.addControl(this.attributionControl);
		}
	},

	_rawPanBy: function (offset) {
		var newPos = L.DomUtil.getPosition(this._mapPane).subtract(offset);
		L.DomUtil.setPosition(this._mapPane, newPos);
	},


	// map events

	_initEvents: function () {
		L.DomEvent.addListener(this._container, 'click', this._onMouseClick, this);

		var events = ['dblclick', 'mousedown', 'mouseenter', 'mouseleave', 'mousemove', 'contextmenu'];

		var i, len;

		for (i = 0, len = events.length; i < len; i++) {
			L.DomEvent.addListener(this._container, events[i], this._fireMouseEvent, this);
		}

		if (this.options.trackResize) {
			L.DomEvent.addListener(window, 'resize', this._onResize, this);
		}
	},

	_onResize: function () {
		L.Util.requestAnimFrame(this.invalidateSize, this, false, this._container);
	},

	_onMouseClick: function (e) {
		if (!this._loaded || (this.dragging && this.dragging.moved())) { return; }

		this.fire('pre' + e.type);
		this._fireMouseEvent(e);
	},

	_fireMouseEvent: function (e) {
		if (!this._loaded) { return; }

		var type = e.type;

		type = (type === 'mouseenter' ? 'mouseover' : (type === 'mouseleave' ? 'mouseout' : type));

		if (!this.hasEventListeners(type)) { return; }

		if (type === 'contextmenu') {
			L.DomEvent.preventDefault(e);
		}

		var containerPoint = this.mouseEventToContainerPoint(e),
			layerPoint = this.containerPointToLayerPoint(containerPoint),
			latlng = this.layerPointToLatLng(layerPoint);

		this.fire(type, {
			latlng: latlng,
			layerPoint: layerPoint,
			containerPoint: containerPoint,
			originalEvent: e
		});
	},

	_initInteraction: function () {
		this
			.addHandler('dragging', L.Map.Drag)
			.addHandler('touchZoom', L.Map.TouchZoom)
			.addHandler('doubleClickZoom', L.Map.DoubleClickZoom)
			.addHandler('scrollWheelZoom', L.Map.ScrollWheelZoom)
			.addHandler('boxZoom', L.Map.BoxZoom);
	},

	_onTileLayerLoad: function () {
		// TODO super-ugly, refactor!!!
		// clear scaled tiles after all new tiles are loaded (for performance)
		this._tileLayersToLoad--;
		if (this._tileLayersNum && !this._tileLayersToLoad && this._tileBg) {
			clearTimeout(this._clearTileBgTimer);
			this._clearTileBgTimer = setTimeout(L.Util.bind(this._clearTileBg, this), 500);
		}
	},


	// private methods for getting map state

	_getTopLeftPoint: function () {
		if (!this._loaded) {
			throw new Error('Set map center and zoom first.');
		}

		var mapPanePos = L.DomUtil.getPosition(this._mapPane);
		return this._initialTopLeftPoint.subtract(mapPanePos);
	},

	_getNewTopLeftPoint: function (center) {
		var viewHalf = this.getSize().divideBy(2);
		// TODO round on display, not calculation to increase precision?
		return this.project(center)._subtract(viewHalf)._round();
	},

	_limitZoom: function (zoom) {
		var min = this.getMinZoom(),
			max = this.getMaxZoom();

		return Math.max(min, Math.min(max, zoom));
	}
});


/*
 * L.TileLayer is used for standard xyz-numbered tile layers.
 */

L.TileLayer = L.Class.extend({
	includes: L.Mixin.Events,

	options: {
		minZoom: 0,
		maxZoom: 18,
		tileSize: {x: 256, y: 256},
		subdomains: 'abc',
		errorTileUrl: '',
		attribution: '',
		opacity: 1,
		scheme: 'xyz',
		continuousWorld: false,
		noWrap: false,
		zoomOffset: 0,
		zoomReverse: false,

		unloadInvisibleTiles: L.Browser.mobile,
		updateWhenIdle: L.Browser.mobile,
		reuseTiles: false
	},

	initialize: function (url, options, urlParams) {
    // Adding support for nonsquare tiles, keeping it compatible.
        if (typeof options.tileSize === 'number') {
            options.tileSize = {x: options.tileSize, y: options.tileSize};
        }
        L.Util.setOptions(this, options);
    
		this._url = url;

		var subdomains = this.options.subdomains;

		if (typeof subdomains === 'string') {
			this.options.subdomains = subdomains.split('');
		}
	},

	onAdd: function (map, insertAtTheBottom) {
		this._map = map;
		this._insertAtTheBottom = insertAtTheBottom;

		// create a container div for tiles
		this._initContainer();

		// create an image to clone for tiles
		this._createTileProto();

		// set up events
		map.on('viewreset', this._resetCallback, this);
		map.on('moveend', this._update, this);

		if (!this.options.updateWhenIdle) {
			this._limitedUpdate = L.Util.limitExecByInterval(this._update, 150, this);
			map.on('move', this._limitedUpdate, this);
		}

		this._reset();
		this._update();
	},

	onRemove: function (map) {
		map._panes.tilePane.removeChild(this._container);

		map.off('viewreset', this._resetCallback, this);
		map.off('moveend', this._update, this);

		if (!this.options.updateWhenIdle) {
			map.off('move', this._limitedUpdate, this);
		}

		this._container = null;
		this._map = null;
	},

	getAttribution: function () {
		return this.options.attribution;
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;

		if (this._map) {
			this._updateOpacity();
		}

		// stupid webkit hack to force redrawing of tiles
		var i,
			tiles = this._tiles;

		if (L.Browser.webkit) {
			for (i in tiles) {
				if (tiles.hasOwnProperty(i)) {
					tiles[i].style.webkitTransform += ' translate(0,0)';
				}
			}
		}
	},

	_updateOpacity: function () {
		L.DomUtil.setOpacity(this._container, this.options.opacity);
	},

	_initContainer: function () {
		var tilePane = this._map._panes.tilePane,
			first = tilePane.firstChild;

		if (!this._container || tilePane.empty) {
			this._container = L.DomUtil.create('div', 'leaflet-layer');

			if (this._insertAtTheBottom && first) {
				tilePane.insertBefore(this._container, first);
			} else {
				tilePane.appendChild(this._container);
			}

			if (this.options.opacity < 1) {
				this._updateOpacity();
			}
		}
	},

	_resetCallback: function (e) {
		this._reset(e.hard);
	},

	_reset: function (clearOldContainer) {
		var key,
			tiles = this._tiles;

		for (key in tiles) {
			if (tiles.hasOwnProperty(key)) {
				this.fire('tileunload', {tile: tiles[key]});
			}
		}

		this._tiles = {};

		if (this.options.reuseTiles) {
			this._unusedTiles = [];
		}

		if (clearOldContainer && this._container) {
			this._container.innerHTML = "";
		}

		this._initContainer();
	},

	_update: function (e) {
		if (this._map._panTransition && this._map._panTransition._inProgress) { return; }

		var bounds   = this._map.getPixelBounds(),
		    zoom     = this._map.getZoom(),
		    tileSize = this.options.tileSize;

		if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
			return;
		}

		var nwTilePoint = new L.Point(
				Math.floor(bounds.min.x / tileSize.x),
				Math.floor(bounds.min.y / tileSize.y)),
			seTilePoint = new L.Point(
				Math.floor(bounds.max.x / tileSize.x),
				Math.floor(bounds.max.y / tileSize.y)),
			tileBounds = new L.Bounds(nwTilePoint, seTilePoint);

		this._addTilesFromCenterOut(tileBounds);

		if (this.options.unloadInvisibleTiles || this.options.reuseTiles) {
			this._removeOtherTiles(tileBounds);
		}
	},

	_addTilesFromCenterOut: function (bounds) {
		var queue = [],
			center = bounds.getCenter();

		var j, i;
		for (j = bounds.min.y; j <= bounds.max.y; j++) {
			for (i = bounds.min.x; i <= bounds.max.x; i++) {
				if (!((i + ':' + j) in this._tiles)) {
					queue.push(new L.Point(i, j));
				}
			}
		}

		// load tiles in order of their distance to center
		queue.sort(function (a, b) {
			return a.distanceTo(center) - b.distanceTo(center);
		});

		var fragment = document.createDocumentFragment();

		this._tilesToLoad = queue.length;

		var k, len;
		for (k = 0, len = this._tilesToLoad; k < len; k++) {
			this._addTile(queue[k], fragment);
		}

		this._container.appendChild(fragment);
	},

	_removeOtherTiles: function (bounds) {
		var kArr, x, y, key, tile;

		for (key in this._tiles) {
			if (this._tiles.hasOwnProperty(key)) {
				kArr = key.split(':');
				x = parseInt(kArr[0], 10);
				y = parseInt(kArr[1], 10);

				// remove tile if it's out of bounds
				if (x < bounds.min.x || x > bounds.max.x || y < bounds.min.y || y > bounds.max.y) {
					this._removeTile(key);
				}
			}
		}
	},

	_removeTile: function (key) {
		var tile = this._tiles[key];

		this.fire("tileunload", {tile: tile, url: tile.src});

		if (tile.parentNode === this._container) {
			this._container.removeChild(tile);
		}
		if (this.options.reuseTiles) {
			this._unusedTiles.push(tile);
		}

		tile.src = L.Util.emptyImageUrl;

		delete this._tiles[key];
	},

	_addTile: function (tilePoint, container) {
		var tilePos = this._getTilePos(tilePoint),
			zoom = this._map.getZoom(),
		    key = tilePoint.x + ':' + tilePoint.y,
		    limit = Math.pow(2, this._getOffsetZoom(zoom));

		// wrap tile coordinates
		if (!this.options.continuousWorld) {
			if (!this.options.noWrap) {
				tilePoint.x = ((tilePoint.x % limit) + limit) % limit;
			} else if (tilePoint.x < 0 || tilePoint.x >= limit) {
				this._tilesToLoad--;
				return;
			}

			if (tilePoint.y < 0 || tilePoint.y >= limit) {
				this._tilesToLoad--;
				return;
			}
		}

		// get unused tile - or create a new tile
		var tile = this._getTile();
		L.DomUtil.setPosition(tile, tilePos);

		this._tiles[key] = tile;

		if (this.options.scheme === 'tms') {
			tilePoint.y = limit - tilePoint.y - 1;
		}

		this._loadTile(tile, tilePoint, zoom);

		container.appendChild(tile);
	},

	_getOffsetZoom: function (zoom) {
		var options = this.options;
		zoom = options.zoomReverse ? options.maxZoom - zoom : zoom;
		return zoom + options.zoomOffset;
	},

	_getTilePos: function (tilePoint) {
		var origin = this._map.getPixelOrigin(),
			tileSize = this.options.tileSize;

		return tilePoint.multiplyBy(tileSize).subtract(origin);
	},

	// image-specific code (override to implement e.g. Canvas or SVG tile layer)

	getTileUrl: function (tilePoint, zoom) {
		var subdomains = this.options.subdomains,
			index = (tilePoint.x + tilePoint.y) % subdomains.length,
			s = this.options.subdomains[index];

		return L.Util.template(this._url, L.Util.extend({
			s: s,
			z: this._getOffsetZoom(zoom),
			x: tilePoint.x,
			y: tilePoint.y
		}, this.options));
	},

	_createTileProto: function () {
		var img = this._tileImg = L.DomUtil.create('img', 'leaflet-tile');
		img.galleryimg = 'no';

		var tileSize = this.options.tileSize;
		this._tileImg.style.width = tileSize.x + 'px';
		this._tileImg.style.height = tileSize.y + 'px';
	},

	_getTile: function () {
		if (this.options.reuseTiles && this._unusedTiles.length > 0) {
			var tile = this._unusedTiles.pop();
			this._resetTile(tile);
			return tile;
		}
		return this._createTile();
	},

	_resetTile: function (tile) {
		// Override if data stored on a tile needs to be cleaned up before reuse
	},

	_createTile: function () {
		var tile = this._tileImg.cloneNode(false);
		tile.onselectstart = tile.onmousemove = L.Util.falseFn;
		return tile;
	},

	_loadTile: function (tile, tilePoint, zoom) {
		tile._layer  = this;
		tile.onload  = this._tileOnLoad;
		tile.onerror = this._tileOnError;

		tile.src     = this.getTileUrl(tilePoint, zoom);
	},

	_tileOnLoad: function (e) {
		var layer = this._layer;

		this.className += ' leaflet-tile-loaded';

		layer.fire('tileload', {
			tile: this,
			url: this.src
		});

		layer._tilesToLoad--;
		if (!layer._tilesToLoad) {
			layer.fire('load');
		}
	},

	_tileOnError: function (e) {
		var layer = this._layer;

		layer.fire('tileerror', {
			tile: this,
			url: this.src
		});

		var newUrl = layer.options.errorTileUrl;
		if (newUrl) {
			this.src = newUrl;
		}
	}
});


/*
 * L.DomEvent contains functions for working with DOM events.
 */

L.DomEvent = {
	/* inpired by John Resig, Dean Edwards and YUI addEvent implementations */
	addListener: function (/*HTMLElement*/ obj, /*String*/ type, /*Function*/ fn, /*Object*/ context) {
		var id = L.Util.stamp(fn),
			key = '_leaflet_' + type + id;

		if (obj[key]) {
			return this;
		}

		var handler = function (e) {
			return fn.call(context || obj, e || L.DomEvent._getEvent());
		};

		if (L.Browser.touch && (type === 'dblclick') && this.addDoubleTapListener) {
			this.addDoubleTapListener(obj, handler, id);
		} else if ('addEventListener' in obj) {
			if (type === 'mousewheel') {
				obj.addEventListener('DOMMouseScroll', handler, false);
				obj.addEventListener(type, handler, false);
			} else if ((type === 'mouseenter') || (type === 'mouseleave')) {
				var originalHandler = handler,
					newType = (type === 'mouseenter' ? 'mouseover' : 'mouseout');
				handler = function (e) {
					if (!L.DomEvent._checkMouse(obj, e)) {
						return;
					}
					return originalHandler(e);
				};
				obj.addEventListener(newType, handler, false);
			} else {
				obj.addEventListener(type, handler, false);
			}
		} else if ('attachEvent' in obj) {
			obj.attachEvent("on" + type, handler);
		}

		obj[key] = handler;

		return this;
	},

	removeListener: function (/*HTMLElement*/ obj, /*String*/ type, /*Function*/ fn) {
		var id = L.Util.stamp(fn),
			key = '_leaflet_' + type + id,
			handler = obj[key];

		if (!handler) {
			return;
		}

		if (L.Browser.touch && (type === 'dblclick') && this.removeDoubleTapListener) {
			this.removeDoubleTapListener(obj, id);
		} else if ('removeEventListener' in obj) {
			if (type === 'mousewheel') {
				obj.removeEventListener('DOMMouseScroll', handler, false);
				obj.removeEventListener(type, handler, false);
			} else if ((type === 'mouseenter') || (type === 'mouseleave')) {
				obj.removeEventListener((type === 'mouseenter' ? 'mouseover' : 'mouseout'), handler, false);
			} else {
				obj.removeEventListener(type, handler, false);
			}
		} else if ('detachEvent' in obj) {
			obj.detachEvent("on" + type, handler);
		}
		obj[key] = null;

		return this;
	},

	_checkMouse: function (el, e) {
		var related = e.relatedTarget;

		if (!related) {
			return true;
		}

		try {
			while (related && (related !== el)) {
				related = related.parentNode;
			}
		} catch (err) {
			return false;
		}

		return (related !== el);
	},

	/*jshint noarg:false */ // evil magic for IE
	_getEvent: function () {
		var e = window.event;
		if (!e) {
			var caller = arguments.callee.caller;
			while (caller) {
				e = caller['arguments'][0];
				if (e && window.Event === e.constructor) {
					break;
				}
				caller = caller.caller;
			}
		}
		return e;
	},
	/*jshint noarg:false */

	stopPropagation: function (/*Event*/ e) {
		if (e.stopPropagation) {
			e.stopPropagation();
		} else {
			e.cancelBubble = true;
		}
		return this;
	},

	disableClickPropagation: function (/*HTMLElement*/ el) {
		return L.DomEvent
			.addListener(el, L.Draggable.START, L.DomEvent.stopPropagation)
			.addListener(el, 'click', L.DomEvent.stopPropagation)
			.addListener(el, 'dblclick', L.DomEvent.stopPropagation);
	},

	preventDefault: function (/*Event*/ e) {
		if (e.preventDefault) {
			e.preventDefault();
		} else {
			e.returnValue = false;
		}
		return this;
	},

	stop: function (e) {
		return L.DomEvent
			.preventDefault(e)
			.stopPropagation(e);
	},

	getMousePosition: function (e, container) {
		var x = e.pageX ? e.pageX : e.clientX +
				document.body.scrollLeft + document.documentElement.scrollLeft,
			y = e.pageY ? e.pageY : e.clientY +
					document.body.scrollTop + document.documentElement.scrollTop,
			pos = new L.Point(x, y);

		return (container ?
					pos.subtract(L.DomUtil.getViewportOffset(container)) : pos);
	},

	getWheelDelta: function (e) {
		var delta = 0;
		if (e.wheelDelta) {
			delta = e.wheelDelta / 120;
		}
		if (e.detail) {
			delta = -e.detail / 3;
		}
		return delta;
	}
};



/*
 * L.Draggable allows you to add dragging capabilities to any element. Supports mobile devices too.
 */

L.Draggable = L.Class.extend({
	includes: L.Mixin.Events,

	statics: {
		START: L.Browser.touch ? 'touchstart' : 'mousedown',
		END: L.Browser.touch ? 'touchend' : 'mouseup',
		MOVE: L.Browser.touch ? 'touchmove' : 'mousemove',
		TAP_TOLERANCE: 15
	},

	initialize: function (element, dragStartTarget) {
		this._element = element;
		this._dragStartTarget = dragStartTarget || element;
	},

	enable: function () {
		if (this._enabled) {
			return;
		}
		L.DomEvent.addListener(this._dragStartTarget, L.Draggable.START, this._onDown, this);
		this._enabled = true;
	},

	disable: function () {
		if (!this._enabled) {
			return;
		}
		L.DomEvent.removeListener(this._dragStartTarget, L.Draggable.START, this._onDown);
		this._enabled = false;
		this._moved = false;
	},

	_onDown: function (e) {
		if ((!L.Browser.touch && e.shiftKey) || ((e.which !== 1) && (e.button !== 1) && !e.touches)) {
			return;
		}

		this._simulateClick = true;

		if (e.touches && e.touches.length > 1) {
			this._simulateClick = false;
			return;
		}

		var first = (e.touches && e.touches.length === 1 ? e.touches[0] : e),
			el = first.target;

		L.DomEvent.preventDefault(e);

		if (L.Browser.touch && el.tagName.toLowerCase() === 'a') {
			el.className += ' leaflet-active';
		}

		this._moved = false;
		if (this._moving) {
			return;
		}

		if (!L.Browser.touch) {
			L.DomUtil.disableTextSelection();
			this._setMovingCursor();
		}

		this._startPos = this._newPos = L.DomUtil.getPosition(this._element);
		this._startPoint = new L.Point(first.clientX, first.clientY);

		L.DomEvent.addListener(document, L.Draggable.MOVE, this._onMove, this);
		L.DomEvent.addListener(document, L.Draggable.END, this._onUp, this);
	},

	_onMove: function (e) {
		if (e.touches && e.touches.length > 1) {
			return;
		}

		L.DomEvent.preventDefault(e);

		var first = (e.touches && e.touches.length === 1 ? e.touches[0] : e);

		if (!this._moved) {
			this.fire('dragstart');
			this._moved = true;
		}
		this._moving = true;

		var newPoint = new L.Point(first.clientX, first.clientY);
		this._newPos = this._startPos.add(newPoint).subtract(this._startPoint);

		L.Util.cancelAnimFrame(this._animRequest);
		this._animRequest = L.Util.requestAnimFrame(this._updatePosition, this, true, this._dragStartTarget);
	},

	_updatePosition: function () {
		this.fire('predrag');
		L.DomUtil.setPosition(this._element, this._newPos);
		this.fire('drag');
	},

	_onUp: function (e) {
		if (this._simulateClick && e.changedTouches) {
			var first = e.changedTouches[0],
				el = first.target,
				dist = (this._newPos && this._newPos.distanceTo(this._startPos)) || 0;

			if (el.tagName.toLowerCase() === 'a') {
				el.className = el.className.replace(' leaflet-active', '');
			}

			if (dist < L.Draggable.TAP_TOLERANCE) {
				this._simulateEvent('click', first);
			}
		}

		if (!L.Browser.touch) {
			L.DomUtil.enableTextSelection();
			this._restoreCursor();
		}

		L.DomEvent.removeListener(document, L.Draggable.MOVE, this._onMove);
		L.DomEvent.removeListener(document, L.Draggable.END, this._onUp);

		if (this._moved) {
			this.fire('dragend');
		}
		this._moving = false;
	},

	_setMovingCursor: function () {
		document.body.className += ' leaflet-dragging';
	},

	_restoreCursor: function () {
		document.body.className = document.body.className.replace(/ leaflet-dragging/g, '');
	},

	_simulateEvent: function (type, e) {
		var simulatedEvent = document.createEvent('MouseEvents');

		simulatedEvent.initMouseEvent(
				type, true, true, window, 1,
				e.screenX, e.screenY,
				e.clientX, e.clientY,
				false, false, false, false, 0, null);

		e.target.dispatchEvent(simulatedEvent);
	}
});


/*
 * L.Handler classes are used internally to inject interaction features to classes like Map and Marker.
 */

L.Handler = L.Class.extend({
	initialize: function (map) {
		this._map = map;
	},

	enable: function () {
		if (this._enabled) {
			return;
		}
		this._enabled = true;
		this.addHooks();
	},

	disable: function () {
		if (!this._enabled) {
			return;
		}
		this._enabled = false;
		this.removeHooks();
	},

	enabled: function () {
		return !!this._enabled;
	}
});


/*
 * L.Handler.MapDrag is used internally by L.Map to make the map draggable.
 */

L.Map.Drag = L.Handler.extend({
	addHooks: function () {
		if (!this._draggable) {
			this._draggable = new L.Draggable(this._map._mapPane, this._map._container);

			this._draggable
				.on('dragstart', this._onDragStart, this)
				.on('drag', this._onDrag, this)
				.on('dragend', this._onDragEnd, this);

			var options = this._map.options;

			if (options.worldCopyJump && !options.continuousWorld) {
				this._draggable.on('predrag', this._onPreDrag, this);
				this._map.on('viewreset', this._onViewReset, this);
			}
		}
		this._draggable.enable();
	},

	removeHooks: function () {
		this._draggable.disable();
	},

	moved: function () {
		return this._draggable && this._draggable._moved;
	},

	_onDragStart: function () {
		var map = this._map;

		map
			.fire('movestart')
			.fire('dragstart');

		if (map._panTransition) {
			map._panTransition._onTransitionEnd(true);
		}

		if (map.options.inertia) {
			this._positions = [];
			this._times = [];
		}
	},

	_onDrag: function () {
		if (this._map.options.inertia) {
			var time = this._lastTime = +new Date(),
			    pos = this._lastPos = this._draggable._newPos;

			this._positions.push(pos);
			this._times.push(time);

			if (time - this._times[0] > 200) {
				this._positions.shift();
				this._times.shift();
			}
		}

		this._map
			.fire('move')
			.fire('drag');
	},

	_onViewReset: function () {
		var pxCenter = this._map.getSize().divideBy(2),
			pxWorldCenter = this._map.latLngToLayerPoint(new L.LatLng(0, 0));

		this._initialWorldOffset = pxWorldCenter.subtract(pxCenter);
	},

	_onPreDrag: function () {
		var map = this._map,
			worldWidth = map.options.scale(map.getZoom()),
			halfWidth = Math.round(worldWidth / 2),
			dx = this._initialWorldOffset.x,
			x = this._draggable._newPos.x,
			newX1 = (x - halfWidth + dx) % worldWidth + halfWidth - dx,
			newX2 = (x + halfWidth + dx) % worldWidth - halfWidth - dx,
			newX = Math.abs(newX1 + dx) < Math.abs(newX2 + dx) ? newX1 : newX2;

		this._draggable._newPos.x = newX;
	},

	_onDragEnd: function () {
		var map = this._map,
			options = map.options,
			delay = +new Date() - this._lastTime,
			
			noInertia = !options.inertia ||
					delay > options.inertiaThreshold ||
					typeof this._positions[0] === 'undefined';

		if (noInertia) {
			map.fire('moveend');

		} else {

			var direction = this._lastPos.subtract(this._positions[0]),
				duration = (this._lastTime + delay - this._times[0]) / 1000,

				speedVector = direction.multiplyBy(0.58 / duration),
				speed = speedVector.distanceTo(new L.Point(0, 0)),

				limitedSpeed = Math.min(options.inertiaMaxSpeed, speed),
				limitedSpeedVector = speedVector.multiplyBy(limitedSpeed / speed),

				decelerationDuration = limitedSpeed / options.inertiaDeceleration,
				offset = limitedSpeedVector.multiplyBy(-decelerationDuration / 2).round();

			var panOptions = {
				duration: decelerationDuration,
				easing: 'ease-out'
			};

			L.Util.requestAnimFrame(L.Util.bind(function () {
				this._map.panBy(offset, panOptions);
			}, this));
		}

		map.fire('dragend');

		if (options.maxBounds) {
			// TODO predrag validation instead of animation
			L.Util.requestAnimFrame(this._panInsideMaxBounds, map, true, map._container);
		}
	},

	_panInsideMaxBounds: function () {
		this.panInsideBounds(this.options.maxBounds);
	}
});


/*
 * L.Handler.DoubleClickZoom is used internally by L.Map to add double-click zooming.
 */

L.Map.DoubleClickZoom = L.Handler.extend({
	addHooks: function () {
		this._map.on('dblclick', this._onDoubleClick);
	},

	removeHooks: function () {
		this._map.off('dblclick', this._onDoubleClick);
	},

	_onDoubleClick: function (e) {
		this.setView(e.latlng, this._zoom + 1);
	}
});


/*
 * L.Handler.ScrollWheelZoom is used internally by L.Map to enable mouse scroll wheel zooming on the map.
 */

L.Map.ScrollWheelZoom = L.Handler.extend({
	addHooks: function () {
		L.DomEvent.addListener(this._map._container, 'mousewheel', this._onWheelScroll, this);
		this._delta = 0;
	},

	removeHooks: function () {
		L.DomEvent.removeListener(this._map._container, 'mousewheel', this._onWheelScroll);
	},

	_onWheelScroll: function (e) {
		var delta = L.DomEvent.getWheelDelta(e);

		this._delta += delta;
		this._lastMousePos = this._map.mouseEventToContainerPoint(e);

		clearTimeout(this._timer);
		this._timer = setTimeout(L.Util.bind(this._performZoom, this), 50);

		L.DomEvent.preventDefault(e);
	},

	_performZoom: function () {
		var map = this._map,
			delta = Math.round(this._delta),
			zoom = map.getZoom();

		delta = Math.max(Math.min(delta, 4), -4);
		delta = map._limitZoom(zoom + delta) - zoom;

		this._delta = 0;

		if (!delta) { return; }

		var newCenter = this._getCenterForScrollWheelZoom(this._lastMousePos, delta),
			newZoom = zoom + delta;

		map.setView(newCenter, newZoom);
	},

	_getCenterForScrollWheelZoom: function (mousePos, delta) {
		var map = this._map,
			centerPoint = map.getPixelBounds().getCenter(),
			viewHalf = map.getSize().divideBy(2),
			centerOffset = mousePos.subtract(viewHalf).multiplyBy(1 - Math.pow(2, -delta)),
			newCenterPoint = centerPoint.add(centerOffset);

		return map.unproject(newCenterPoint, map._zoom, true);
	}
});


L.Util.extend(L.DomEvent, {
	// inspired by Zepto touch code by Thomas Fuchs
	addDoubleTapListener: function (obj, handler, id) {
		var last,
			doubleTap = false,
			delay = 250,
			touch,
			pre = '_leaflet_',
			touchstart = 'touchstart',
			touchend = 'touchend';

		function onTouchStart(e) {
			if (e.touches.length !== 1) {
				return;
			}

			var now = Date.now(),
				delta = now - (last || now);

			touch = e.touches[0];
			doubleTap = (delta > 0 && delta <= delay);
			last = now;
		}
		function onTouchEnd(e) {
			if (doubleTap) {
				touch.type = 'dblclick';
				handler(touch);
				last = null;
			}
		}
		obj[pre + touchstart + id] = onTouchStart;
		obj[pre + touchend + id] = onTouchEnd;

		obj.addEventListener(touchstart, onTouchStart, false);
		obj.addEventListener(touchend, onTouchEnd, false);
	},

	removeDoubleTapListener: function (obj, id) {
		var pre = '_leaflet_';
		obj.removeEventListener(obj, obj[pre + 'touchstart' + id], false);
		obj.removeEventListener(obj, obj[pre + 'touchend' + id], false);
	}
});


/*
 * L.Handler.TouchZoom is used internally by L.Map to add touch-zooming on Webkit-powered mobile browsers.
 */

L.Map.TouchZoom = L.Handler.extend({
	addHooks: function () {
		L.DomEvent.addListener(this._map._container, 'touchstart', this._onTouchStart, this);
	},

	removeHooks: function () {
		L.DomEvent.removeListener(this._map._container, 'touchstart', this._onTouchStart, this);
	},

	_onTouchStart: function (e) {
		var map = this._map;

		if (!e.touches || e.touches.length !== 2 || map._animatingZoom || this._zooming) { return; }

		var p1 = map.mouseEventToLayerPoint(e.touches[0]),
			p2 = map.mouseEventToLayerPoint(e.touches[1]),
			viewCenter = map.containerPointToLayerPoint(map.getSize().divideBy(2));

		this._startCenter = p1.add(p2).divideBy(2, true);
		this._startDist = p1.distanceTo(p2);

		this._moved = false;
		this._zooming = true;

		this._centerOffset = viewCenter.subtract(this._startCenter);

		L.DomEvent
			.addListener(document, 'touchmove', this._onTouchMove, this)
			.addListener(document, 'touchend', this._onTouchEnd, this);

		L.DomEvent.preventDefault(e);
	},

	_onTouchMove: function (e) {
		if (!e.touches || e.touches.length !== 2) { return; }

		var map = this._map;

		var p1 = map.mouseEventToLayerPoint(e.touches[0]),
			p2 = map.mouseEventToLayerPoint(e.touches[1]);

		this._scale = p1.distanceTo(p2) / this._startDist;
		this._delta = p1.add(p2).divideBy(2, true).subtract(this._startCenter);

		if (this._scale === 1) { return; }

		if (!this._moved) {
			map._mapPane.className += ' leaflet-zoom-anim';

			map
				.fire('zoomstart')
				.fire('movestart')
				._prepareTileBg();

			this._moved = true;
		}

		// Used 2 translates instead of transform-origin because of a very strange bug -
		// it didn't count the origin on the first touch-zoom but worked correctly afterwards

		map._tileBg.style.webkitTransform =
			L.DomUtil.getTranslateString(this._delta) + ' ' +
            L.DomUtil.getScaleString(this._scale, this._startCenter);

		L.DomEvent.preventDefault(e);
	},

	_onTouchEnd: function (e) {
		if (!this._moved || !this._zooming) { return; }

		this._zooming = false;

		L.DomEvent
			.removeListener(document, 'touchmove', this._onTouchMove)
			.removeListener(document, 'touchend', this._onTouchEnd);

		var centerOffset = this._centerOffset.subtract(this._delta).divideBy(this._scale),
			centerPoint = this._map.getPixelOrigin().add(this._startCenter).add(centerOffset),
			center = this._map.unproject(centerPoint),

			oldZoom = this._map.getZoom(),
			floatZoomDelta = Math.log(this._scale) / Math.LN2,
			roundZoomDelta = (floatZoomDelta > 0 ? Math.ceil(floatZoomDelta) : Math.floor(floatZoomDelta)),
			zoom = this._map._limitZoom(oldZoom + roundZoomDelta),
			finalScale = Math.pow(2, zoom - oldZoom);

		this._map._runAnimation(center, zoom, finalScale / this._scale, this._startCenter.add(centerOffset));
	}
});


/*
 * L.Handler.ShiftDragZoom is used internally by L.Map to add shift-drag zoom (zoom to a selected bounding box).
 */

L.Map.BoxZoom = L.Handler.extend({
	initialize: function (map) {
		this._map = map;
		this._container = map._container;
		this._pane = map._panes.overlayPane;
	},

	addHooks: function () {
		L.DomEvent.addListener(this._container, 'mousedown', this._onMouseDown, this);
	},

	removeHooks: function () {
		L.DomEvent.removeListener(this._container, 'mousedown', this._onMouseDown);
	},

	_onMouseDown: function (e) {
		if (!e.shiftKey || ((e.which !== 1) && (e.button !== 1))) { return false; }

		L.DomUtil.disableTextSelection();

		this._startLayerPoint = this._map.mouseEventToLayerPoint(e);

		this._box = L.DomUtil.create('div', 'leaflet-zoom-box', this._pane);
		L.DomUtil.setPosition(this._box, this._startLayerPoint);

		//TODO refactor: move cursor to styles
		this._container.style.cursor = 'crosshair';

		L.DomEvent
			.addListener(document, 'mousemove', this._onMouseMove, this)
			.addListener(document, 'mouseup', this._onMouseUp, this)
			.preventDefault(e);
	},

	_onMouseMove: function (e) {
		var startPoint = this._startLayerPoint,
			box = this._box,

			layerPoint = this._map.mouseEventToLayerPoint(e),
			offset = layerPoint.subtract(startPoint),

			newPos = new L.Point(
				Math.min(layerPoint.x, startPoint.x),
				Math.min(layerPoint.y, startPoint.y));

		L.DomUtil.setPosition(box, newPos);

		// TODO refactor: remove hardcoded 4 pixels
		box.style.width  = (Math.abs(offset.x) - 4) + 'px';
		box.style.height = (Math.abs(offset.y) - 4) + 'px';
	},

	_onMouseUp: function (e) {
		this._pane.removeChild(this._box);
		this._container.style.cursor = '';

		L.DomUtil.enableTextSelection();

		L.DomEvent
			.removeListener(document, 'mousemove', this._onMouseMove)
			.removeListener(document, 'mouseup', this._onMouseUp);

		var map = this._map,
			layerPoint = map.mouseEventToLayerPoint(e);

		var bounds = new L.LatLngBounds(
				map.layerPointToLatLng(this._startLayerPoint),
				map.layerPointToLatLng(layerPoint));

		map.fitBounds(bounds);
	}
});


L.Transition = L.Class.extend({
	includes: L.Mixin.Events,

	statics: {
		CUSTOM_PROPS_SETTERS: {
			position: L.DomUtil.setPosition
			//TODO transform custom attr
		},

		implemented: function () {
			return L.Transition.NATIVE || L.Transition.TIMER;
		}
	},

	options: {
		easing: 'ease',
		duration: 0.5
	},

	_setProperty: function (prop, value) {
		var setters = L.Transition.CUSTOM_PROPS_SETTERS;
		if (prop in setters) {
			setters[prop](this._el, value);
		} else {
			this._el.style[prop] = value;
		}
	}
});


/*
 * L.Transition native implementation that powers Leaflet animation
 * in browsers that support CSS3 Transitions
 */

L.Transition = L.Transition.extend({
	statics: (function () {
		var transition = L.DomUtil.TRANSITION,
			transitionEnd = (transition === 'webkitTransition' || transition === 'OTransition' ?
				transition + 'End' : 'transitionend');

		return {
			NATIVE: !!transition,

			TRANSITION: transition,
			PROPERTY: transition + 'Property',
			DURATION: transition + 'Duration',
			EASING: transition + 'TimingFunction',
			END: transitionEnd,

			// transition-property value to use with each particular custom property
			CUSTOM_PROPS_PROPERTIES: {
				position: L.Browser.webkit ? L.DomUtil.TRANSFORM : 'top, left'
			}
		};
	}()),

	options: {
		fakeStepInterval: 100
	},

	initialize: function (/*HTMLElement*/ el, /*Object*/ options) {
		this._el = el;
		L.Util.setOptions(this, options);

		L.DomEvent.addListener(el, L.Transition.END, this._onTransitionEnd, this);
		this._onFakeStep = L.Util.bind(this._onFakeStep, this);
	},

	run: function (/*Object*/ props) {
		var prop,
			propsList = [],
			customProp = L.Transition.CUSTOM_PROPS_PROPERTIES;

		for (prop in props) {
			if (props.hasOwnProperty(prop)) {
				prop = customProp[prop] ? customProp[prop] : prop;
				prop = this._dasherize(prop);
				propsList.push(prop);
			}
		}

		this._el.style[L.Transition.DURATION] = this.options.duration + 's';
		this._el.style[L.Transition.EASING] = this.options.easing;
		this._el.style[L.Transition.PROPERTY] = propsList.join(', ');

		for (prop in props) {
			if (props.hasOwnProperty(prop)) {
				this._setProperty(prop, props[prop]);
			}
		}

		this._inProgress = true;

		this.fire('start');

		if (L.Transition.NATIVE) {
			clearInterval(this._timer);
			this._timer = setInterval(this._onFakeStep, this.options.fakeStepInterval);
		} else {
			this._onTransitionEnd();
		}
	},

	_dasherize: (function () {
		var re = /([A-Z])/g;

		function replaceFn(w) {
			return '-' + w.toLowerCase();
		}

		return function (str) {
			return str.replace(re, replaceFn);
		};
	}()),

	_onFakeStep: function () {
		this.fire('step');
	},

	_onTransitionEnd: function (e) {
		if (this._inProgress) {
			this._inProgress = false;
			clearInterval(this._timer);

			this._el.style[L.Transition.PROPERTY] = 'none';

			this.fire('step');

			if (e && e.type) {
				this.fire('end');
			}
		}
	}
});


/*
 * L.Transition fallback implementation that powers Leaflet animation
 * in browsers that don't support CSS3 Transitions
 */

L.Transition = L.Transition.NATIVE ? L.Transition : L.Transition.extend({
	statics: {
		getTime: Date.now || function () {
			return +new Date();
		},

		TIMER: true,

		EASINGS: {
			'ease': [0.25, 0.1, 0.25, 1.0],
			'linear': [0.0, 0.0, 1.0, 1.0],
			'ease-in': [0.42, 0, 1.0, 1.0],
			'ease-out': [0, 0, 0.58, 1.0],
			'ease-in-out': [0.42, 0, 0.58, 1.0]
		},

		CUSTOM_PROPS_GETTERS: {
			position: L.DomUtil.getPosition
		},

		//used to get units from strings like "10.5px" (->px)
		UNIT_RE: /^[\d\.]+(\D*)$/
	},

	options: {
		fps: 50
	},

	initialize: function (el, options) {
		this._el = el;
		L.Util.extend(this.options, options);

		var easings = L.Transition.EASINGS[this.options.easing] || L.Transition.EASINGS.ease;

		this._p1 = new L.Point(0, 0);
		this._p2 = new L.Point(easings[0], easings[1]);
		this._p3 = new L.Point(easings[2], easings[3]);
		this._p4 = new L.Point(1, 1);

		this._step = L.Util.bind(this._step, this);
		this._interval = Math.round(1000 / this.options.fps);
	},

	run: function (props) {
		this._props = {};

		var getters = L.Transition.CUSTOM_PROPS_GETTERS,
			re = L.Transition.UNIT_RE;

		this.fire('start');

		for (var prop in props) {
			if (props.hasOwnProperty(prop)) {
				var p = {};
				if (prop in getters) {
					p.from = getters[prop](this._el);
				} else {
					var matches = this._el.style[prop].match(re);
					p.from = parseFloat(matches[0]);
					p.unit = matches[1];
				}
				p.to = props[prop];
				this._props[prop] = p;
			}
		}

		clearInterval(this._timer);
		this._timer = setInterval(this._step, this._interval);
		this._startTime = L.Transition.getTime();
	},

	_step: function () {
		var time = L.Transition.getTime(),
			elapsed = time - this._startTime,
			duration = this.options.duration * 1000;

		if (elapsed < duration) {
			this._runFrame(this._cubicBezier(elapsed / duration));
		} else {
			this._runFrame(1);
			this._complete();
		}
	},

	_runFrame: function (percentComplete) {
		var setters = L.Transition.CUSTOM_PROPS_SETTERS,
			prop, p, value;

		for (prop in this._props) {
			if (this._props.hasOwnProperty(prop)) {
				p = this._props[prop];
				if (prop in setters) {
					value = p.to.subtract(p.from).multiplyBy(percentComplete).add(p.from);
					setters[prop](this._el, value);
				} else {
					this._el.style[prop] =
							((p.to - p.from) * percentComplete + p.from) + p.unit;
				}
			}
		}
		this.fire('step');
	},

	_complete: function () {
		clearInterval(this._timer);
		this.fire('end');
	},

	_cubicBezier: function (t) {
		var a = Math.pow(1 - t, 3),
			b = 3 * Math.pow(1 - t, 2) * t,
			c = 3 * (1 - t) * Math.pow(t, 2),
			d = Math.pow(t, 3),
			p1 = this._p1.multiplyBy(a),
			p2 = this._p2.multiplyBy(b),
			p3 = this._p3.multiplyBy(c),
			p4 = this._p4.multiplyBy(d);

		return p1.add(p2).add(p3).add(p4).y;
	}
});


L.Map.include(!(L.Transition && L.Transition.implemented()) ? {} : {
	setView: function (center, zoom, forceReset) {
		zoom = this._limitZoom(zoom);

		var zoomChanged = (this._zoom !== zoom);

		if (this._loaded && !forceReset && this._layers) {
			// difference between the new and current centers in pixels
			var offset = this._getNewTopLeftPoint(center).subtract(this._getTopLeftPoint());

			center = new L.LatLng(center.lat, center.lng);

			var done = (zoomChanged ?
					this._zoomToIfCenterInView && this._zoomToIfCenterInView(center, zoom, offset) :
					this._panByIfClose(offset));

			// exit if animated pan or zoom started
			if (done) {
				return this;
			}
		}

		// reset the map view
		this._resetView(center, zoom);

		return this;
	},

	panBy: function (offset, options) {
		if (!(offset.x || offset.y)) {
			return this;
		}

		if (!this._panTransition) {
			this._panTransition = new L.Transition(this._mapPane);

			this._panTransition.on('step', this._onPanTransitionStep, this);
			this._panTransition.on('end', this._onPanTransitionEnd, this);
		}

		L.Util.setOptions(this._panTransition, L.Util.extend({duration: 0.25}, options));

		this.fire('movestart');

		this._mapPane.className += ' leaflet-pan-anim';

		this._panTransition.run({
			position: L.DomUtil.getPosition(this._mapPane).subtract(offset)
		});

		return this;
	},

	_onPanTransitionStep: function () {
		this.fire('move');
	},

	_onPanTransitionEnd: function () {
		this._mapPane.className = this._mapPane.className.replace(/ leaflet-pan-anim/g, '');
		this.fire('moveend');
	},

	_panByIfClose: function (offset) {
		if (this._offsetIsWithinView(offset)) {
			this.panBy(offset);
			return true;
		}
		return false;
	},

	_offsetIsWithinView: function (offset, multiplyFactor) {
		var m = multiplyFactor || 1,
			size = this.getSize();

		return (Math.abs(offset.x) <= size.x * m) &&
				(Math.abs(offset.y) <= size.y * m);
	}
});


L.Map.include(!L.DomUtil.TRANSITION ? {} : {
	_zoomToIfCenterInView: function (center, zoom, centerOffset) {

		if (this._animatingZoom) {
			return true;
		}
		if (!this.options.zoomAnimation) {
			return false;
		}

		var scale = Math.pow(2, zoom - this._zoom),
			offset = centerOffset.divideBy(1 - 1 / scale);

		// if offset does not exceed half of the view
		if (!this._offsetIsWithinView(offset, 1)) {
			return false;
		}

		this._mapPane.className += ' leaflet-zoom-anim';

        this
			.fire('movestart')
			.fire('zoomstart');

		this._prepareTileBg();

		var centerPoint = this.containerPointToLayerPoint(this.getSize().divideBy(2)),
			origin = centerPoint.add(offset);

		this._runAnimation(center, zoom, scale, origin);

		return true;
	},


	_runAnimation: function (center, zoom, scale, origin) {
		this._animatingZoom = true;

		this._animateToCenter = center;
		this._animateToZoom = zoom;

		var transform = L.DomUtil.TRANSFORM,
			tileBg = this._tileBg;

		clearTimeout(this._clearTileBgTimer);

		//dumb FireFox hack, I have no idea why this magic zero translate fixes the scale transition problem
		if (L.Browser.gecko || window.opera) {
			tileBg.style[transform] += ' translate(0,0)';
		}

		var scaleStr;

		// Android 2.* doesn't like translate/scale chains, transformOrigin + scale works better but
		// it breaks touch zoom which Anroid doesn't support anyway, so that's a really ugly hack

		// TODO work around this prettier
		if (L.Browser.android) {
			tileBg.style[transform + 'Origin'] = origin.x + 'px ' + origin.y + 'px';
			scaleStr = 'scale(' + scale + ')';
		} else {
			scaleStr = L.DomUtil.getScaleString(scale, origin);
		}

		L.Util.falseFn(tileBg.offsetWidth); //hack to make sure transform is updated before running animation

		var options = {};
		options[transform] = tileBg.style[transform] + ' ' + scaleStr;

		tileBg.transition.run(options);
	},

	_prepareTileBg: function () {
		var tilePane = this._tilePane,
			tileBg = this._tileBg;

		if (!tileBg) {
			tileBg = this._tileBg = this._createPane('leaflet-tile-pane', this._mapPane);
			tileBg.style.zIndex = 1;
		}

		// prepare the background pane to become the main tile pane
		tileBg.style[L.DomUtil.TRANSFORM] = '';
		tileBg.style.visibility = 'hidden';

		// tells tile layers to reinitialize their containers
		tileBg.empty = true;
		tilePane.empty = false;

		this._tilePane = this._panes.tilePane = tileBg;
		var newTileBg = this._tileBg = tilePane;

		if (!newTileBg.transition) {
			// TODO move to Map options
			newTileBg.transition = new L.Transition(newTileBg, {
				duration: 0.25,
				easing: 'cubic-bezier(0.25,0.1,0.25,0.75)'
			});
			newTileBg.transition.on('end', this._onZoomTransitionEnd, this);
		}

		this._stopLoadingImages(newTileBg);
	},

	// stops loading all tiles in the background layer
	_stopLoadingImages: function (container) {
		var tiles = Array.prototype.slice.call(container.getElementsByTagName('img')),
			i, len, tile;

		for (i = 0, len = tiles.length; i < len; i++) {
			tile = tiles[i];

			if (!tile.complete) {
				tile.onload = L.Util.falseFn;
				tile.onerror = L.Util.falseFn;
				tile.src = L.Util.emptyImageUrl;

				tile.parentNode.removeChild(tile);
			}
		}
	},

	_onZoomTransitionEnd: function () {
		this._restoreTileFront();

		L.Util.falseFn(this._tileBg.offsetWidth);
		this._resetView(this._animateToCenter, this._animateToZoom, true, true);

		this._mapPane.className = this._mapPane.className.replace(' leaflet-zoom-anim', ''); //TODO toggleClass util
		this._animatingZoom = false;
	},

	_restoreTileFront: function () {
		this._tilePane.innerHTML = '';
		this._tilePane.style.visibility = '';
		this._tilePane.style.zIndex = 2;
		this._tileBg.style.zIndex = 1;
	},

	_clearTileBg: function () {
		if (!this._animatingZoom && !this.touchZoom._zooming) {
			this._tileBg.innerHTML = '';
		}
	}
});


/*
 * Provides L.Map with convenient shortcuts for W3C geolocation.
 */

L.Map.include({
	_defaultLocateOptions: {
		watch: false,
		setView: false,
		maxZoom: Infinity,
		timeout: 10000,
		maximumAge: 0,
		enableHighAccuracy: false
	},

	locate: function (/*Object*/ options) {

		options = this._locationOptions = L.Util.extend(this._defaultLocateOptions, options);

		if (!navigator.geolocation) {
			return this.fire('locationerror', {
				code: 0,
				message: "Geolocation not supported."
			});
		}

		var onResponse = L.Util.bind(this._handleGeolocationResponse, this),
			onError = L.Util.bind(this._handleGeolocationError, this);

		if (options.watch) {
			this._locationWatchId = navigator.geolocation.watchPosition(onResponse, onError, options);
		} else {
			navigator.geolocation.getCurrentPosition(onResponse, onError, options);
		}
		return this;
	},

	stopLocate: function () {
		if (navigator.geolocation) {
			navigator.geolocation.clearWatch(this._locationWatchId);
		}
		return this;
	},

	_handleGeolocationError: function (error) {
		var c = error.code,
			message =
				(c === 1 ? "permission denied" :
				(c === 2 ? "position unavailable" : "timeout"));

		if (this._locationOptions.setView && !this._loaded) {
			this.fitWorld();
		}

		this.fire('locationerror', {
			code: c,
			message: "Geolocation error: " + message + "."
		});
	},

	_handleGeolocationResponse: function (pos) {
		var latAccuracy = 180 * pos.coords.accuracy / 4e7,
			lngAccuracy = latAccuracy * 2,

			lat = pos.coords.latitude,
			lng = pos.coords.longitude,
			latlng = new L.LatLng(lat, lng),

			sw = new L.LatLng(lat - latAccuracy, lng - lngAccuracy),
			ne = new L.LatLng(lat + latAccuracy, lng + lngAccuracy),
			bounds = new L.LatLngBounds(sw, ne),

			options = this._locationOptions;

		if (options.setView) {
			var zoom = Math.min(this.getBoundsZoom(bounds), options.maxZoom);
			this.setView(latlng, zoom);
		}

		this.fire('locationfound', {
			latlng: latlng,
			bounds: bounds,
			accuracy: pos.coords.accuracy
		});
	}
});


