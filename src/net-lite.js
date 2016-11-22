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
