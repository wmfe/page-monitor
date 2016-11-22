/**
 * pageMonitor https://wmfe.github.io/page-monitor/
 * 百度外卖 - 前端数据捕获与上报组件
 */
~(function (win) {
    var navigator = win.navigator;
    var location = win.location;
    var screen = win.screen;
    var doc = win.document;

    var BDWMMonitor = win.BDWMMonitor || {};

    BDWMMonitor.url = "//log.waimai.baidu.com/static/exceptionjs.gif?";

    BDWMMonitor.beforeReport = function (type, data) {
        return data;
    };
    // TODO
    // common  & single
    //
    var initConfig = parserQ();

    BDWMMonitor.init = function () {
        var modules = initConfig.module;
        var conf = initConfig.conf;
        BDWMMonitor._conf = {
            platform: conf.platform,
            app: conf.app,
            channel: conf.channel,
            // 新增pageid级别
            pageid: conf.pageid || 0,
            //
            traceCode: ''
        };
        conf.url ? BDWMMonitor.url = conf.url : null;
        conf.beforeReport ? BDWMMonitor.beforeReport = conf.beforeReport : null;
        // 黑名单
        if (!validatePageBlackList(conf.pageWhiteList)) {
            modules.forEach(function (item, index) {
                BDWMMonitor.use(item);
            });
        }
        // trace code
        var domLoaded = function () {
            BDWMMonitor._conf.traceCode = getTraceCode();
        };
        window.addEventListener("DOMContentLoaded", function () {
            domLoaded();
            window.removeEventListener("DOMContentLoaded", domLoaded);
        });

        // user agent
        var UA = matchUA(navigator.userAgent);
        // screen
        var _screen = screen.width + '*' + screen.height + '|' + screen.availWidth + '*' + screen.availHeight;

        // TODO mobile ua
        if (conf.channel === 'pc') {
            BDWMMonitor._conf.browser = UA.browser + '|' + UA.version;
        }
        BDWMMonitor._conf._screen = _screen;

    };
    BDWMMonitor._module = {};
    BDWMMonitor.define = function (moduleName, factory) {
        if (BDWMMonitor._module[moduleName]) {
            throw new Error(moduleName + ' Already defined');
        } else {
            BDWMMonitor._module[moduleName] = factory();
        }
    };

    // report //

    BDWMMonitor.report = function (type, data) {
        if (!BDWMMonitor.url || !type || !data) {
            return;
        }

        data = BDWMMonitor.beforeReport(type, data);

        if (!data) {
            throw new Error('Report data is empty');
        }

        var conf = BDWMMonitor._conf;

        if (!conf.app || !conf.channel || !conf.platform) {
            throw new Error("Global report data fragmentary");
        }
        // TODO merge data 重复字段校验
        data = merge(conf, data);
        // @see http://jsperf.com/new-image-vs-createelement-img
        var image = doc.createElement('img');
        var url = BDWMMonitor.url;

        var items = [];
        for (var key in data) {
            items.push(key + '=' + encodeURIComponent(data[key]));
        }

        var name = 'img_' + (+new Date());
        BDWMMonitor[name] = image;
        image.onload = image.onerror = function () {
            BDWMMonitor[name] =
                image =
                    image.onload =
                        image.onerror = null;
            delete BDWMMonitor[name];
        };

        image.src = url + (url.indexOf('?') < 0 ? '?' : '&') + items.join('&');
    };
    BDWMMonitor.error = function (data) {
        BDWMMonitor.report('exception', data);
    };
    BDWMMonitor.use = function (moduleName) {
        if (BDWMMonitor._module[moduleName]){
            BDWMMonitor._module[moduleName].run();
        }else {
            initConfig[moduleName] &&
            (BDWMMonitor._module[moduleName] = initConfig[moduleName]()) &&
            BDWMMonitor._module[moduleName].run();
        }
    };


    function matchUA(ua) {
        var chrome = /(chrome)\/(\d+\.\d)/;
        var safari = /(\d+\.\d)?(?:\.\d)?\s+safari\/?(\d+\.\d+)?/;
        var opera = /(opera)(?:.*version)?[ \/]([\w.]+)/;
        var msie = /(msie) ([\w.]+)/;
        var mozilla = /(mozilla)(?:.*? rv:([\w.]+))?/;
        ua = ua.toLowerCase();
        var result = chrome.exec(ua) ||
            opera.exec(ua) ||
            msie.exec(ua) ||
            // see https://user-agents.me/useragent/mozilla40-compatible-msie-70-windows-nt-61-wow64-trident50-slcc2-net-clr-2050727-net-clr-3530729-net-clr-3030729-media-center-pc-60
            (ua.indexOf("compatible") < 0 && mozilla.exec(ua)) ||
            [];
        // safari
        if (safari.exec(ua) && !/chrome/.test(ua)) {
            result[1] = 'safari';
            result[2] = RegExp.$1 || RegExp.$2
        }
        return {
            browser: result[1] || "unknown",
            version: result[2] || "0"
        }
    }

    function getTraceCode() {
        var bodyChilds = document.body.childNodes,
            code = "";

        for (var j = bodyChilds.length - 1; j >= 0; j--) {
            if (bodyChilds[j].nodeType == document.COMMENT_NODE) {
                code = bodyChilds[j].textContent;
                break;
            }
        }

        return code;
    }

    function validatePageBlackList(list) {
        if (!list || (Array.isArray(list) && !list.length)){
            return false;
        }
        var pass = false;
        if (Array.isArray(list)){
            list.some(function (v, k) {
                var reg = new RegExp(v);
                if (reg.test(location.href)) {
                    pass = true;
                    return true;
                }
            });
        }else {
            pass = (list == location.href)
        }
        return pass;
    }

    function merge(a, b) {
        var result = {};
        for (var p in a) {
            if (a.hasOwnProperty(p)) {
                result[p] = a[p];
            }
        }
        for (var q in b) {
            if (b.hasOwnProperty(q)) {
                result[q] = b[q];
            }
        }
        return result;
    }

    function forEach(obj, iterate, context) {
        if (obj.length === +obj.length) {
            for (var i = 0; i < obj.length; i++) {
                iterate.call(context, i, obj[i], obj);
            }
        } else {
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    iterate.call(context, key, obj[key], obj);
                }
            }
        }
    }

    function parserQ() {
        var q = BDWMMonitor.q;
        if (!q) {
            return {}
        }
        var result = {};
        for (var i = 0; i < q.length; i++) {
            result[q[i][0]] = q[i][1];
        }
        return result;
    }
    BDWMMonitor.init();
})(window);
