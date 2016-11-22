/**
 * js异常监控
 */
~(function (win) {
    var BDWMMonitor = win.BDWMMonitor;
    var location = win.location;
    BDWMMonitor('exception',function () {
        return {
            run: function () {
                this.catchException();
            },
            catchException: function () {
                window.onerror = function (msg, url, line, col, error) {
                    var newMsg = msg;
                    if (error && error.stack) {
                        newMsg = _processStackMsg(error);
                    }
                    BDWMMonitor.report('exception', {
                        tag: 'js_error',
                        err_txt: newMsg,
                        url: url,
                        purl: location.href,
                        ln: line,
                        col: col,
                        err_status: 401
                    })
                };

                function _processStackMsg(error) {
                    var stack = error.stack
                        .replace(/\n/gi, "")
                        .split(/\bat\b/)
                        .slice(0, 9)
                        .join("@")
                        .replace(/\?[^:]+/gi, "");
                    var msg = error.toString();
                    if (stack.indexOf(msg) < 0) {
                        stack = msg + "@" + stack;
                    }
                    return stack;
                }
            }
        }
    });
})(window);

/**
 * 网络通信监控 - 简版 （无资源加载耗时监控）
 *    ajax请求监控
 */
(function (win) {
    var BDWMMonitor = win.BDWMMonitor;
    var location = win.location;
    BDWMMonitor('net', function () {
        return {
            run: function () {
                this.resourceHook();
                this.initXhrHook();
            },
            /**
             * 页面资源监控(script/link/img)
             *
             */
            resourceHook: function () {
                window.addEventListener('error', function (event) {
                    var target = event.srcElement || event.target;
                    if (!(target instanceof HTMLElement)) {
                        return;
                    }
                    var tagName = target.tagName.toLowerCase();
                    if (!/script|link|img/.test(tagName)) {
                        return;
                    }
                    BDWMMonitor.report('exception', {
                        tag: 'resource_error',
                        url: target.src || target.href,
                        purl: location.href,
                        err_status: "404",
                        err_msg: "Not Found"
                    });
                }, true);

                this.resourceLoadAdapter(true);
                this.resourceLoadAdapter(false);
            },
            resourceLoadAdapter: function (succ) {
                var defaultNetLoadSucc = function () {
                    },
                    defaultNetLoadFail = function () {
                    },
                    //smarty默认资源加载成功处理方法名称
                    defaultSuccHandlerName = "_resourceLoadSucc",
                    defaultFailHandlerName = "_resourceLoadFail",
                    handlerName = succ ? defaultSuccHandlerName : defaultFailHandlerName,
                    handler = succ ? defaultNetLoadSucc : defaultNetLoadFail;

                if (win[handlerName]) {
                    var oldHandler = win[handlerName];
                    win[handlerName] = function (target) {
                        oldHandler(target);
                        handler(target);
                    }
                }
                else {
                    win[handlerName] = handler;
                }
            },
            /**
             * 监听ajax的error，统一处理ajax异常信息
             */
            initXhrHook: function () {
                var me = this;
                if (window.XMLHttpRequest) {
                    me.xhrHook(window.XMLHttpRequest);
                }
                document.addEventListener("DOMContentLoaded", function (event) {
                    console.log('????????? net')
                    me.initjQueryAjaxHook();
                });
            },
            initjQueryAjaxHook: function () {
                if (!window.jQuery && !window.Zepto) {
                    return;
                }
                $(document).ajaxError(function (evt, jqXhr, settings, thrownError) {
                    BDWMMonitor.report('exception', {
                        tag: 'xhr',
                        url: settings.url,
                        method: settings.type,
                        purl: location.href,
                        err_status: jqXhr.status,
                        err_txt: jqXhr.statusText
                    })
                });
            },
            xhrHook: function (klass) {
                var open = klass.prototype.open;
                var send = klass.prototype.send;
                var me = this;
                var name = '';
                klass.prototype.open = function (method, url) {
                    //直接绑到xhr上
                    this._track = {
                        method: method.toLowerCase(),
                        url: url
                    };
                    name = 'xhr_' + (+new Date());
                    return open.apply(this, arguments)
                };
                klass.prototype.send = function () {
                    this._trackName = name;
                    win[name] = true;
                    me.registerComplete(this);
                    return send.apply(this, arguments);
                };
            },
            registerComplete: function (xhr) {
                var me = this;
                if (xhr.addEventListener) {
                    xhr.addEventListener('readystatechange', function () {
                        if (xhr.readyState == 4) {
                            me.checkComplete(xhr)
                        }
                    }, true)
                }
                else {
                    setTimeout(function () {
                        var onload = xhr.onload;
                        xhr.onload = function () {
                            me.checkComplete(xhr);
                            return onload.apply(xhr, arguments)
                        }

                        var onerror = xhr.onerror;
                        xhr.onerror = function () {
                            me.checkComplete(xhr);
                            return onerror.apply(xhr, arguments)
                        }
                    }, 0)
                }
            },
            checkComplete: function (xhr) {
                if (xhr._track) {
                    if (win[xhr._trackName] && xhr.status >= 400) {
                        BDWMMonitor.report('exception', {
                            tag: 'xhr',
                            url: xhr._track.url,
                            method: xhr._track.method,
                            purl: location.href,
                            err_status: xhr.status,
                            err_txt: xhr.statusText
                        })
                    }
                    delete xhr._trackName;
                    delete xhr._track;
                    delete win[xhr._trackName];
                }
            }
        }
    });
})(window);

/**
 *  性能数据数据收集
 *
 *
 * timing api:
 *
 * === >> newwork <<===
 navigationStart           : "准备加载新页面的起始时间"

 //跳转时间
 redirectStart             : "跳转开始时的时间。",
 redirectEnd               : "跳转结束时时间。",

 //缓存时间
 fetchStart                : "返回浏览器准备使用HTTP请求读取文档时的时间。该事件在网页查询本地缓存之前发生",

 //域名查询时间:如果是静态(304),返回fetchStart
 domainLookupStart         : "返回域名查询开始时的时间。",
 domainLookupEnd           : "返回域名查询结束时的时间。",

 //建立连接与发送请求时间:如果是静态(304),返回fetchStart
 connectStart              : "返回HTTP请求开始向服务器发送时的时间",
 connectEnd                : "连接建立指的是所有握手和认证过程全部结束",

 === >> server <<===
 //返回浏览器与服务器安全连接握手时间
 secureConnectionStart     : "返回浏览器与服务器开始安全链接的握手时的时间。",

 //下载时间
 requestStart              : "返回浏览器向服务器发出HTTP请求时时间",
 responseStart             : "返回浏览器从服务器收到第一个字节时的时间",
 responseEnd               : "返回浏览器从服务器收到最后一个字节时（如果在此之前HTTP连接已经关闭，则返回关闭时）的时间",

 === >> browser <<===
 //dom渲染时间
 domLoading                : "返回当前网页DOM结构开始解析时的时间",
 domInteractive            : "返回当前网页DOM结构结束解析、开始加载内嵌资源时间",
 domContentLoadedEventStart: "返回当前网页DOMContentLoaded事件发生时（即DOM结构解析完毕、所有脚本开始运行时）的时间",
 domContentLoadedEventEnd  : "返回当前网页所有需要执行的脚本执行完成时的时间",
 domComplete               : "返回当前网页DOM结构生成时的时间",

 //
 loadEventStart            : "返回当前网页load事件的回调函数开始时的时间。",
 loadEventEnd              : "返回当前网页load事件的回调函数运行结束时的时间。"
 *
 */
(function (win) {
    var BDWMMonitor = win.BDWMMonitor;
    var performance = win.performance || win.webkitPerformance || win.msPerformance || win.mozPerformance;
    BDWMMonitor('perf', function () {
        var time = {};
        var perf = {};
        return {
            run: function () {
                this.domHook();
            },
            domHook: function () {
                var me = this;
                document.onreadystatechange = function(){
                    if (document.readyState === "complete") {
                        me.collectPerf();
                    }
                }
            },
            collectPerf: function () {
                if (!performance) {
                    return;
                }
                this.collect();
                //
                BDWMMonitor.report('perf', perf);
            },
            /**
             * 收集网络性能数据 *各标准时间节点 + 复合计算时间
             */
            collect: function () {
                if (!performance) {
                    return;
                }
                var timing = performance.timing;
                var nav = shotFind("navigation");
                var req = shotFind("request");
                var res = shotFind('response');
                var dns = shotFind("domainLookup");
                var con = shotFind('connect');
                var load = shotFind('loadEvent');
                var unload = shotFind('unloadEvent');

                var navigationStart = timing.navigationStart;
                time.p_dns = timing.domainLookupEnd;
                time.p_ct = timing.connectEnd;
                time.p_st = timing.responseStart;
                time.p_tt = timing.responseEnd;
                time.p_dct = timing.domComplete;
                time.p_olt = timing.loadEventEnd;
                forEach(time, function (a, b) {
                    // 取值基于 navigationStart
                    time[a] = Math.max(b - navigationStart, 0)
                });

                var computed = {
                    // p_nav: timing.fetchStart - nav.start,
                    // 上一个页面卸载时间
                    // p_unload: unload.value,
                    // DNS查找耗时
                    p_lookup: dns.value,
                    // tcp链接耗时  * timing.connectEnd - timing.domainLookupEnd
                    p_tcp: con.value,
                    // 开始SSL握手的时间。 如果不是HTTPS， 那么就返回0
                    p_ssl: (timing.secureConnectionStart > 0 ? (timing.connectEnd - timing.secureConnectionStart) : 0),
                    // 首字节响应时间
                    p_ttfb: res.start - req.start,
                    // 下载时间
                    p_download: res.value,
                    // 文档下载时间（包括建立连接时间）
                    p_to_download: res.end - nav.start,
                    // 建立连接时间
                    p_to_connect: con.end - nav.start,
                    //
                    // ext_req_part: 1,

                    // 页面文档渲染完成时间
                    p_dom_ready: timing.domComplete - timing.domLoading,
                    // DOM结构生成时间（包含网络加载等时间）
                    p_to_dom_ready: timing.domComplete - timing.navigationStart,
                    // onload事件执行时间
                    p_dom_loaded: load.value,
                    // 应用可用时间（包含网络加载等时间）
                    p_to_dom_loaded: load.end - nav.start,

                    // net all
                    p_net: req.start - nav.start,
                    // backend all
                    p_srv: res.end - req.start,
                    // frontend all
                    p_brw: load.end - timing.domLoading
                };
                forEach(time, function (key, value) {
                    perf[key] = value;
                });
                forEach(computed, function (key, value) {
                    perf[key] = value;
                });

                var msg = [
                    'network: ' + computed.p_net,
                    'server: ' + computed.p_srv,
                    'browser: ' + computed.p_brw
                ];
                win.__perf = msg.join('\n')
            }
        }

    });
    function shotFind(key) {
        var timing = performance.timing;
        var start = timing[key + "Start"] ? timing[key + "Start"] : 0;
        var end = timing[key + "End"] ? timing[key + "End"] : 0;
        return {
            start: start,
            end: end,
            value: 0 < end - start ? end - start : 0
        }
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
})(window);

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
        // 白名单
        if (validatePageWhiteList(conf.pageWhiteList)) {
            // do some thing
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
        console.log('report',arguments)
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

    function validatePageWhiteList(list) {
        var pass = false;
        if (Array.isArray(list)) {
            list.some(function (v, k) {
                if (v.test(location.href)) {
                    pass = true;
                }
            });
            list.length ? null : pass = true;
        } else {
            pass = (list == location.href);
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
            console.log(q[i]);
        }
        return result;
    }
    BDWMMonitor.init();
})(window);
