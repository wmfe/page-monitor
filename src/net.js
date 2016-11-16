/**
 *
 */
~(function(win){
    var BDWMMonitor = win.BDWMMonitor ;
    var location = window.location;
    BDWMMonitor.define('net', function(){
        return {
            run : function(){
                this.catchException();
                this.domHook();
                this.resourceHook();
            },
            domHook: function(){
                var me = this;
                var deferCall = function () {
                    if (document.readyState == "complete") {
                        me.initjQueryAjaxHook();
                        document.removeEventListener("readystatechange", deferCall);
                    }else {
                        document.addEventListener("readystatechange", deferCall);
                    }
                };
            },
            /**
             * 页面资源监控
             *  example: <script type="text/javascript" src="a.js"  onload="_resourceLoadSucc(this)" onerror="_resourceLoadFail(this)" crossorigin ></script>
             */
            resourceHook: function(){
                this.resourceLoadAdapter(true);
                this.resourceLoadAdapter(false);
            },
            resourceLoadAdapter(succ){
                var defaultNetLoadSucc = this.declareResLoadSucc,
                    defaultNetLoadFail = this.declareResLoadFail,
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
            catchException(){
                window.addEventListener("error", function (exception) {
                    BDWMMonitor.report('exception',{
                        purl: location.href,
                        url: exception.filename,
                        err_status: 401,
                        //crossorigin 则读取summary
                        err_txt: exception.message
                    })
                });
            },
            /**
             * 监听ajax的error，统一处理ajax异常信息
             */
            initjQueryAjaxHook: function () {
                if (!jQuery) {
                    return;
                }

                $(document).ajaxError(function (evt, jqXhr, settings, thrownError) {
                    BDWMMonitor.report('exception',{
                        url: settings.url,
                        purl: location.href,
                        err_status: jqXhr.status,
                        err_txt: jqXhr.statusText
                    })
                });
            },
            /**
             * 页面中生命的资源（JS、CSS）加载失败后的处理
             */
            declareResLoadFail: function (target) {
                if (!(target instanceof HTMLElement)) {
                    return;
                }
                BDWMMonitor.report('exception',{
                    url: target.src || target.href,
                    purl: location.href,
                    err_status: "404",
                    err_msg: "Not Found"
                });
            },
            /**
             * 页面中生命的资源（JS、CSS）加载成功后的处理
             */
            declareResLoadSucc: function (target) {
                //TODO...
            }
        }
    })
})(window);
