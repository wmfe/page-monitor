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

      /*=require reporter.js */
      /*=require net.js */
      /*=require perf.js */
      /*=require runtime.js */

      win.BDWMMonitor={
          /**
           * 初始化
           * @param use              {Array} 使用的功能模块，net:网络监测；perf:性能监测；runtime:运行时监控
           * @param reportGlobalData {Object}
           * @param reportWhiteList  {Array} 数据上报白名单，根据url匹配的正则，不在白名单的页面将不会上报数据（目前仅作用于性能数据上报）
           */
          init:function(use,reportGlobalData,reportWhiteList){
              if(!Utils.isArr(use) || !use.length){
                  return;
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
