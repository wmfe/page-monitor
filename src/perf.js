(function (host) {

    var timing = window.performance.timing;
    var initiatorWhiteList = ["script", "link", "xmlhttprequest"]

    //PerformanceObserver监控的类型
    //参考：https://w3c.github.io/performance-timeline/
    var observerEntryTypes = ["resource", "measure"];
    //设定上报阈值，measure的duration大于该阈值才会触发上报
    //考虑服务端日志承受能力，如果服务端没限制可以取消该阈值限制
    var maxDurationThreshold = 500;

    var Helper = {
        resolvePath: function (path) {
            var pathReg = /^(?:[\.]{1,2}\/?)*\/?\w+/,
                curDomain,
                domainReg = /^http(?:s)?:\/\//;

            if (!pathReg.test(path) || domainReg.test(path)) {
                return path
            }
            var hrefSplit = location.href.split("/"),
                pathSplit = path.split("/"),
                parentPathNum = 0;

            //相对路径  ../ ./，../a/b/c.php；./a/b/c.php
            if (/^\.{1,2}$/.test(pathSplit[0])) {
                pathSplit.some(function (v) {
                    if (v == "..") {
                        parentPathNum++
                    }
                })

                hrefSplit = hrefSplit.slice(0, Math.max(3, hrefSplit.length - parentPathNum - 1));
                hrefSplit.push(pathSplit[pathSplit.length - 1]);
            }
            else {
                //相对跟目录，/a/b/c.php
                if (/^\/.+/.test(path)) {
                    hrefSplit = [location.protocol + "//" + location.host]
                    hrefSplit.push(path.substr(1))
                }
                //相对当前页面所在目录，a/b/c.php
                else {
                    //http://xx.baidu.com/a.html => http://xx.baidu.com/
                    hrefSplit = hrefSplit.slice(0, hrefSplit.length - 1)
                    hrefSplit.push(path)
                }
            }
            return hrefSplit.join("/");
        }
    }

    var report = function (data) {
        data = Object.assign({
        }, data);

        reportor.report(data, false);
    }

    /**
     * 页面加载完成后，所有资源请求耗时监控（ajax等）
     */
    var RequestMonitor = {
        init: function () {
            var me = this,
                deferCall = function () {
                    if (document.readyState == "complete") {
                        me.initObserve();
                        document.removeEventListener("readystatechange", deferCall);
                    }
                };

            //应该在DOM ready后开始监听，否则可能存在监听不到的情况
            if (document.readyState == "complete") {
                me.initObserve();
            }
            else {
                document.addEventListener("readystatechange", deferCall);
            }
        },
        initAjaxObserve: function () {
            if (window.jQuery || window.Zepto) {
                this.initjQueryObserve();
            }
        },
        initjQueryObserve: function () {
            var me = this
            $(document).ajaxComplete(function (evt, xhr, settings) {
                var perfEntry = me.getLastEntryByUrl(settings.url);

                if (perfEntry) {
                    me.analyzePerfEntry(perfEntry);
                }
            })
        },
        initPerfObserve: function () {
            var me = this;
            if (window.PerformanceObserver) {
                var observer = new window.PerformanceObserver(function (list) {
                    var entries = list.getEntriesByType("resource");
                    for (var i = 0; i < entries.length; i++) {
                        var entry = entries[i];

                        //observer可以监控到log请求，防止循环发送log请求
                        if (/log\.waimai\.baidu\.com/.test(entry.name)) {
                            continue;
                        }

                        //只收集白名单中的资源请求
                        if (initiatorWhiteList.indexOf(entry.initiatorType) == -1) {
                            continue;
                        }
                        me.analyzePerfEntry(entry);
                    }
                });
                observer.observe({
                    entryTypes: observerEntryTypes
                });
            }
        },
        initObserve: function () {
            // this.initPerfObserve();
            this.initAjaxObserve();
        },
        getLastEntryByUrl: function (url) {
            var result = null;

            performance.getEntries().some(function (entry) {
                if (entry.name == Helper.resolvePath(url)) {
                    result = entry;
                    return true;
                }
            })

            return result
        },
        analyzePerfEntry: function (entry) {
            var d = entry.duration;

            if (d > maxDurationThreshold) {
                report({
                    p_lookup: entry.domainLookupEnd - entry.domainLookupStart,
                    p_tcp: entry.connectEnd - entry.connectStart,
                    p_ssl: entry.secureConnectionStart > 0 ? (entry.connectEnd - entry.secureConnectionStart) : 0,
                    p_ttfb: entry.responseStart - entry.requestStart,
                    p_download: entry.responseEnd - entry.responseStart,
                    p_to_download: d,
                    p_to_connect: entry.connectEnd - entry.fetchStart,
                    url: entry.name
                })
            }
        }
    }

    //页面性能监控
    var PagePerfMonitor = {
        /**
         * 验证白名单
         * 暂时页面性能统计只在制定的白名单页面上报
         * @param whiteList {Array} [RegExp,RegExp]
         * @return {Boolean}
         */
        validate: function (whiteList) {
            var pass = false;
            if (Utils.isArr(whiteList)) {
                whiteList.some(function (v, k) {
                    if (Utils.isReg(v)) {
                        if (v.test(location.href)) {
                            pass = true;
                            return true;
                        }
                    }
                })
            }
            else {
                pass = whiteList == location.href;
            }

            return pass;
        },
        /**
         * 收集页面文档的性能数据
         */
        reportDocTiming: function () {
            report({
                p_nav: timing.fetchStart - timing.navigationStart,
                p_unload: timing.unloadEventEnd - timing.unloadEventStart,
                p_lookup: timing.domainLookupEnd - timing.domainLookupStart,
                p_tcp: timing.connectEnd - timing.connectStart,
                p_ssl: (timing.secureConnectionStart > 0 ? (timing.connectEnd - timing.secureConnectionStart) : 0),
                p_ttfb: timing.responseStart - timing.requestStart,
                p_download: timing.responseEnd - timing.responseStart,
                p_to_download: timing.responseEnd - timing.navigationStart,
                p_to_connect: timing.connectEnd - timing.navigationStart,
                ext_req_part: 1
            })
        },
        /**
         * 收集页面资源的性能数据
         */
        reportDocResourceTiming: function () {
            report({
                p_dom_ready: timing.domComplete - timing.domLoading,
                p_to_dom_ready: timing.domComplete - timing.navigationStart,
                p_dom_loaded: timing.loadEventEnd - timing.loadEventStart,
                p_to_dom_loaded: timing.loadEventEnd - timing.navigationStart,
                ext_req_part: 2
            })
        },
        init: function (whiteList) {
            var me = this,
                deferCall = function () {
                    if (document.readyState == "complete") {
                        setTimeout(function () {
                            me.reportDocResourceTiming();

                            document.removeEventListener("readystatechange", deferCall);
                        }, 100);
                    }
                };

            if (!this.validate(whiteList)) {
                return;
            }

            me.reportDocTiming();

            if (document.readyState == "complete") {
                me.reportDocResourceTiming();
            }
            else {
                document.addEventListener("readystatechange", deferCall);
            }
        }
    }

    host["Perf"] = {
        init: function (whiteList) {
            PagePerfMonitor.init(whiteList);
            RequestMonitor.init();
        }
    }

})(modules);
