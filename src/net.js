/**
 * 网络通信监控
 *    ajax请求监控
 *    资源加载监控
 */
(function (win) {
    var BDWMMonitor = win.BDWMMonitor;
    var location = window.location;
    var performance = window.performance || window.webkitPerformance || window.msPerformance || window.mozPerformance;
    BDWMMonitor.define('net', function () {
        var initiatorWhiteList = ["script", "link", "xmlhttprequest"];
        //PerformanceObserver监控的类型
        //参考：https://w3c.github.io/performance-timeline/
        var observerEntryTypes = ["resource", "measure"];
        //设定上报阈值，measure的duration大于该阈值才会触发上报
        //考虑服务端日志承受能力，如果服务端没限制可以取消该阈值限制
        var maxDurationThreshold = 500;
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
                        err_txt: "Not Found"
                    });
                }, true);

                this.initPerfObserve();
                //
                this.resourceLoadAdapter(true);
                this.resourceLoadAdapter(false);

            },
            resourceLoadAdapter:function(succ){
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
            initjQueryObserve: function () {
                var me = this;
                if (!window.jQuery && !window.Zepto) {
                    return;
                }
                $(document).ajaxComplete(function (evt, xhr, settings) {
                    var perfEntry = me.getLastEntryByUrl(settings.url);
                    if (perfEntry) {
                        me.analyzePerfEntry(perfEntry);
                    }
                })
            },
            analyzePerfEntry: function (entry) {
                var d = entry.duration;
                if (d > maxDurationThreshold) {
                    BDWMMonitor.report('resource', {
                        tag: 'resource_timing',
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
            },
            /**
             * 页面请求监控
             */
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
            getLastEntryByUrl: function (url) {
                var result = null;
                performance.getEntries().some(function (entry) {
                    if (entry.name == Helper.resolvePath(url)) {
                        result = entry;
                        return true;
                    }
                });

                return result
            },
            /**
             * 监听ajax的error，统一处理ajax异常信息
             */
            initXhrHook: function(){
                var me = this;
                if (window.XMLHttpRequest) {
                    me.xhrHook(window.XMLHttpRequest);
                }
                document.addEventListener("DOMContentLoaded", function(event) {
                    me.initjQueryAjaxHook();
                    me.initjQueryObserve();
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
                klass.prototype.open = function(method, url) {
                    //直接绑到xhr上
                    this._track = {
                        method: method.toLowerCase(),
                        url: url
                    };
                    name = 'xhr_' + (+new Date());
                    return open.apply(this, arguments)
                };
                klass.prototype.send = function() {
                    this._trackName = name;
                    win[name] = true;
                    me.registerComplete(this);
                    return send.apply(this, arguments);
                };
            },
            registerComplete: function(xhr) {
                var me = this;
                if (xhr.addEventListener) {
                    xhr.addEventListener('readystatechange', function() {
                        if (xhr.readyState == 4) {
                            me.checkComplete(xhr)
                        }
                    }, true)
                }
                else {
                    setTimeout(function() {
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
            checkComplete: function(xhr) {
                if (xhr._track) {
                    if (win[xhr._trackName] && xhr.status >= 400){
                        BDWMMonitor.report('exception', {
                            tag: 'xhr',
                            url: xhr._track.url,
                            method:xhr._track.method,
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
})(window);
