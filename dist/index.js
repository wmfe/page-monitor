/**
  * 模块入口
  */

  (function(win){

      var defaultReportUrl="//log.waimai.baidu.com/static/exceptionjs.gif?";
      // var defaultReportUrl="http://my.log.waimai.baidu.com/receiver.php?";
      var reportor=null;
      var modules={};

      var Utils={
          type:function(v){
              return Object.prototype.toString.call(v);
          },
          isArr:function(v){
              return Utils.type(v)=="[object Array]";
          },
          isReg:function(v){
              return Utils.type(v)=="[object RegExp]";
          },
          isNum:function(v){
              return Utils.type(v)=="[object Number]";
          }
      };

      function resourceLoadAdapter(succ){
          var defaultNetLoadSucc=modules.Net.declareResLoadSucc,
              defaultNetLoadFail=modules.Net.declareResLoadFail,
              //smarty默认资源加载成功处理方法名称
              defaultSuccHandlerName="_resourceLoadSucc",
              defaultFailHandlerName="_resourceLoadFail",
              handlerName=succ?defaultSuccHandlerName:defaultFailHandlerName,
              handler=succ?defaultNetLoadSucc:defaultNetLoadFail;

          if(win[handlerName]){
              var oldHandler=win[handlerName];
              win[handlerName]=function(target){
                  oldHandler(target);
                  handler(target);
              }
          }
          else{
              win[handlerName]=handler;
          }
      };

      /**
        * 数据上报模块
        */
      
        (function(host){
            function Reportor(reportUrl,globalData){
                var me=this,
                    domLoaded=function(){
                        me.globalData.trace_code=me.getTraceCode();
                        window.removeEventListener("DOMContentLoaded",domLoaded);
                    };
      
                if(!reportUrl){
                    throw new Error("Reportor must have reportUrl");
                }
      
                //http://wiki.baidu.com/pages/viewpage.action?pageId=212853689
                if(
                    !globalData.app ||
                    !globalData.channel ||
                    !globalData.platform
                ){
                    throw new Error("Global report data fragmentary")
                }
      
                me.globalData=globalData;
      
                me.reportUrl=reportUrl;
      
                window.addEventListener("DOMContentLoaded",domLoaded);
            }
      
            Reportor.prototype={
                /**
                 * 获取页面中的tracecode
                 */
                getTraceCode:function(){
                    var bodyChilds=document.body.childNodes,
                        code="";
      
                    for(var j=bodyChilds.length-1;j>=0;j--){
                        if(bodyChilds[j].nodeType==document.COMMENT_NODE){
                            code=bodyChilds[j].textContent;
                            break;
                        }
                    }
      
                    return code;
                },
                /**
                 * 过滤掉所有值为”假“的上报数据
                 * @private
                 * @param v {Array} [[],[]]
                 * @return {Array} [[],[]]
                 */
                filterFalsely:function(v){
                    var result=[];
      
                    v.forEach(function(v,i){
                        if(v[1]){
                            result.push(v);
                        }
                    });
      
                    return result;
                },
                /**
                 * 格式化上报数据结构
                 * @public
                 * @param v {Object|Array} 上报数据
                 * @return {Array} [[k,v],[k,v]]
                 */
                format:function(v){
                    var me=this,
                        result=[];
      
                    if(Utils.isArr(v)){
                        v.forEach(function(v,i){
                            if(v.length==2){
                                if(Utils.isNum(v[1])){
                                    v[1]=Math.max(0,v[1].toFixed(2));
                                }
                                else{
                                    v[1]=encodeURIComponent(v[1]);
                                }
                                result.push(v);
                            }
                        })
                    }
                    else{
                        v=Object(v);
                        for(var k in v){
                            if(v.hasOwnProperty(k)){
                                var kv=v[k];
                                result.push([k,kv]);
                            }
                        }
      
                        result=me.format(result);
                    }
      
                    return result;
                },
                /**
                 * 上报
                 * @public
                 * @param data          {Object|Array}
                 * @param ignoreFalsely {Boolean}       是否忽略”空”值的上报
                 */
                report:function(data,ignoreFalsely){
                    var me=this;
      
                    data=me.format(Object.assign({},me.globalData,data));
      
                    if(ignoreFalsely){
                        data=me.filterFalsely(data);
                    }
      
                    me.send(data.reduce(function(prevValue,curValue){
                        return prevValue+=curValue.join("=")+"&";
                    },""));
                },
                /**
                 * 发送上报数据
                 * @private
                 * @param dataStr  {String}  上报的参数字符串
                 */
                send:function(dataStr){
                    var me=this,
                        img=new Image(),
                        reportUrl=me.reportUrl;
      
                    img.onload=function(){
                        img=null;
                    }
                    img.src=reportUrl+dataStr;
                }
            }
      
            host["Reportor"]=Reportor;
        })(modules);
      
      /**
        * 网络监测模块
        */
      
        (function(host){
      
            var report=function(data){
                data=Object.assign({
                },data);
      
                reportor.report(data,true);
            }
      
            var NetMonitor={
                init:function(){
                    var me=this,
                        deferCall=function(){
                            if(document.readyState=="complete"){
                                me.initjQueryAjaxHook();
      
                                document.removeEventListener("readystatechange",deferCall);
                            }
                        };
      
                    if(document.readyState=="complete"){
                        me.initjQueryAjaxHook();
                    }
                    else{
                        document.addEventListener("readystatechange",deferCall);
                    }
                },
                /**
                 * 监听ajax的error，统一处理ajax异常信息
                 */
                initjQueryAjaxHook:function(){
                    if(!jQuery){
                        return;
                    }
      
                    $(document).ajaxError(function(evt,jqXhr,settings,thrownError){
                        report({
                            url:settings.url,
                            purl:location.href,
                            err_status:jqXhr.status,
                            err_txt:jqXhr.statusText
                        })
                    });
                },
                /**
                 * 页面中生命的资源（JS、CSS）加载失败后的处理
                 */
                declareResLoadFail:function(target){
                    if(!(target instanceof HTMLElement)){
                        return;
                    }
                    report({
                        url:target.src || target.href,
                        purl:location.href,
                        err_status:"404",
                        err_msg:"Not Found"
                    });
                },
                /**
                 * 页面中生命的资源（JS、CSS）加载成功后的处理
                 */
                declareResLoadSucc:function(target){
                    //TODO...
                }
            }
      
            host["Net"]=NetMonitor;
        })(modules);
      
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
      
      /**
        * 运行时监测模块
        * 如监测页面运行时异常
        */
      
        (function(host){
      
            var report=function(data){
                data=Object.assign({
                },data);
      
                reportor.report(data,true);
            }
      
            var Runtime={
                init:function(){
                    var me=this;
      
                    window.addEventListener("error",function(exception){
                        console.log("error:",arguments);
                        report({
                            purl:location.href,
                            url:exception.filename,
                            err_status:401,
                            //crossorigin 则读取summary
                            err_txt:exception.message
                        })
                    });
                }
            }
      
            host["Runtime"]=Runtime;
        })(modules);
      

      win.BDWMMonitor={
        /**
         * 初始化
         * @param use              {Array} 使用的功能模块，net:网络监测；perf:性能监测；runtime:运行时监控
         * @param reportGlobalData {Object}
         * @param reportWhiteList  {Array} 数据上报白名单，根据url匹配的正则，不在白名单的页面将不会上报数据（目前仅作用于性能数据上报）
         */
        init:function(use,reportGlobalData,reportWhiteList){
            if(!Utils.isArr(use) || !use.length){
                return
            }

            // 只统计线上环境
            // 用这种策略是否合适或具备通用性有待商榷
            if(["443","80",""].indexOf(location.port)==-1){
                return
            }

            reportor=new modules.Reportor(defaultReportUrl,{
                platform:reportGlobalData.platform,
                app:reportGlobalData.app,
                channel:reportGlobalData.channel,
                wid:reportGlobalData.wid,
                city_id:reportGlobalData.city_id,
                protocol:location.protocol.substr(0,location.protocol.length-1)
            });

            if(use.indexOf("net")>-1){
                modules.Net.init();
                resourceLoadAdapter(true);
                resourceLoadAdapter(false);
            }
            if(use.indexOf("perf")>-1){
                modules.Perf.init(reportWhiteList);
            }
            if(use.indexOf("runtime")>-1){
                modules.Runtime.init();
            }
        }
    }

  })(window);
