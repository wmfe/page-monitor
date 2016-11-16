/**
 *  性能数据数据收集
 *
 * timing api:
 *
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

 //返回浏览器与服务器安全连接握手时间
 secureConnectionStart     : "返回浏览器与服务器开始安全链接的握手时的时间。",

 //下载时间
 requestStart              : "返回浏览器向服务器发出HTTP请求时时间",
 responseStart             : "返回浏览器从服务器收到第一个字节时的时间",
 responseEnd               : "返回浏览器从服务器收到最后一个字节时（如果在此之前HTTP连接已经关闭，则返回关闭时）的时间",

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
    var navigator = win.navigator;
    var screen = win.screen;
    var BDWMMonitor = win.BDWMMonitor ;
    var performance = window.performance || window.webkitPerformance || window.msPerformance || window.mozPerformance;
    BDWMMonitor.define('perf', function(){
        var time = {};
        var perf = {};
        return {
            run: function(){
                this.domHook();
            },
            domHook: function(){
                var me = this;
                var deferCall = function () {
                    if (document.readyState == "complete") {
                        setTimeout(function () {
                            me.collect();
                            document.removeEventListener("readystatechange", deferCall);
                        }, 100);
                    }
                };
                if (document.readyState !== "complete") {
                    document.addEventListener("readystatechange", deferCall);
                }
            },
            collect: function(){
                this.collectNetWork();
                this.collectBrowser();
                console.log(perf);
            },
            collectNetWork: function(){
                if (!performance) {
                    return ;
                }
                var timing = performance.timing;
                var navigationStart = timing.navigationStart;
                time.p_dns = timing.domainLookupEnd;
                time.p_ct = timing.connectEnd;
                time.p_st = timing.responseStart;
                time.p_tt = timing.responseEnd;
                time.p_dct = timing.domComplete;
                time.p_olt = timing.loadEventEnd;
                forEach(time, function (a, b) {
                    time[a] = Math.max(b - navigationStart, 0)
                });
            },
            collectBrowser: function(){
                function matchUA(ua) {
                    var chrome = /(chrome)\/(\d+\.\d)/;
                    var safari = /(\d+\.\d)?(?:\.\d)?\s+safari\/?(\d+\.\d+)?/;
                    var opera = /(opera)(?:.*version)?[ \/]([\w.]+)/;
                    var msie = /(msie) ([\w.]+)/;
                    var mozilla = /(mozilla)(?:.*? rv:([\w.]+))?/;
                    //a = a.toLowerCase(),
                    //g = b.exec(a) || d.exec(a) || e.exec(a) || a.indexOf("compatible") < 0 && f.exec(a) || [];
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
                var UA = matchUA(navigator.userAgent);
                var BROWSER_SHORT_KEY = {
                    msie: 10,
                    chrome: 20,
                    mozilla: 30,
                    safari: 40,
                    opera: 50
                };
                // 屏幕状况
                var _screen = screen.width + '*' + screen.height + '|' + screen.availWidth + '*' + screen.availHeight;
                perf.browser = BROWSER_SHORT_KEY[UA.browser];
                perf._screen = _screen;
                // TODO NA

                var timing = performance.timing;
                if (!performance) {
                    return ;
                }
                // dom timing
                var computed = {
                    // 开始加载新页面 到 发起新的资源请求之间的耗时，包括重定向耗时
                    p_nav: timing.fetchStart - timing.navigationStart,
                    // 上一个页面卸载时间
                    p_unload: timing.unloadEventEnd - timing.unloadEventStart,
                    // DNS查找耗时
                    p_lookup: timing.domainLookupEnd - timing.domainLookupStart,
                    // tcp链接耗时  * timing.connectEnd - timing.domainLookupEnd
                    p_tcp: timing.connectEnd - timing.connectStart,
                    // 开始SSL握手的时间。 如果不是HTTPS， 那么就返回0
                    p_ssl: (timing.secureConnectionStart > 0 ? (timing.connectEnd - timing.secureConnectionStart) : 0),
                    // 首字节响应时间
                    p_ttfb: timing.responseStart - timing.requestStart,
                    // 下载时间
                    p_download: timing.responseEnd - timing.responseStart,
                    // 文档下载时间（包括建立连接时间）
                    p_to_download: timing.responseEnd - timing.navigationStart,
                    // 建立连接时间
                    p_to_connect: timing.connectEnd - timing.navigationStart,
                    //
                    // ext_req_part: 1,

                    // 页面文档渲染完成时间
                    p_dom_ready: timing.domComplete - timing.domLoading,
                    // DOM结构生成时间（包含网络加载等时间）
                    p_to_dom_ready: timing.domComplete - timing.navigationStart,
                    // onload事件执行时间
                    p_dom_loaded: timing.loadEventEnd - timing.loadEventStart,
                    // 应用可用时间（包含网络加载等时间）
                    p_to_dom_loaded: timing.loadEventEnd - timing.navigationStart,

                    // 内嵌资源加载时间
                    // p_es: timing.domComplete - timing.domInteractive,

                    //  appcache
                    //appcacheTime: timing.domainLookupStart - timing.fetchStart;
                };
                forEach(time, function (key, value) {
                    perf[key] = value;
                });
                forEach(computed,function (key, value){
                    perf[key] = value;
                });
            }
        }

    });
    function forEach(obj,iterate,context){
        if (obj.length === +obj.length) {
            for(var i=0;i<obj.length;i++){
                iterate.call(context, i, obj[i], obj);
            }
        }else{
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    iterate.call(context, key, obj[key], obj);
                }
            }
        }
    }
})(window);
