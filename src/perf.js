/**
 *  性能数据数据收集
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
    var performance = window.performance || window.webkitPerformance || window.msPerformance || window.mozPerformance;
    BDWMMonitor.define('perf', function () {
        var time = {};
        var perf = {};
        return {
            run: function () {
                this.domHook();
            },
            domHook: function () {
                var me = this;
                var deferCall = function () {
                    if (document.readyState == "complete") {
                        setTimeout(function () {
                            me.collectPerf();
                            document.removeEventListener("readystatechange", deferCall);
                        }, 100);
                    }
                };
                if (document.readyState !== "complete") {
                    document.addEventListener("readystatechange", deferCall);
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
                    p_nav: timing.fetchStart - nav.start,
                    // 上一个页面卸载时间
                    p_unload: unload.value,
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

                    //
                    netAll: req.start - nav.start,
                    srv: res.start - req.start,
                    dom: timing.domInteractive - timing.fetchStart
                };
                forEach(time, function (key, value) {
                    perf[key] = value;
                });
                forEach(computed, function (key, value) {
                    perf[key] = value;
                });

                var msg = [
                    'network: ' + computed.netAll,
                    'server: ' + computed.srv,
                    'browser: ' + (load.end - timing.domLoading)
                ];
                window.__perf = msg.join('\n')
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
