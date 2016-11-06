/**
  * 性能采集模块
  */

  (function(host){

      var timing=window.performance.timing;
      var initiatorWhiteList=["script","link","xmlhttprequest"]

      //PerformanceObserver监控的类型
      //参考：https://w3c.github.io/performance-timeline/
      var observerEntryTypes=["resource","measure"];
      //设定上报阈值，measure的duration大于该阈值才会触发上报
      //考虑服务端日志承受能力，如果服务端没限制可以取消该阈值限制
      var maxDurationThreshold=1000;

      var report=function(data){
          data=Object.assign({
          },data);

          reportor.report(data,false);
      }

      /**
       * 页面加载完成后，所有资源请求耗时监控（ajax等）
       */
      var RequestMonitor={
          init:function(){
              var me=this,
                  deferCall=function(){
                      if(document.readyState=="complete"){
                          me.initObserve();
                          document.removeEventListener("readystatechange",deferCall);
                      }
                  };

              //应该在DOM ready后开始监听，否则可能存在监听不到的情况
              if(document.readyState=="complete"){
                  me.initObserve();
              }
              else{
                  document.addEventListener("readystatechange",deferCall);
              }
          },
          initObserve:function(){
              //高版本浏览器存在该接口
              //后续需要考虑兼容性问题
              if(!window.PerformanceObserver){
                  return
              }
              var observer=new window.PerformanceObserver(function(list){
                  var entries=list.getEntriesByType("resource");
                  for(var i=0;i<entries.length;i++){
                      var entry=entries[i];
                      var d=entry.duration;

                      //observer可以监控到log请求，防止循环发送log请求
                      if(/log\.waimai\.baidu\.com/.test(entry.name)){
                          continue;
                      }

                      //只收集白名单中的资源请求
                      if(initiatorWhiteList.indexOf(entry.initiatorType)==-1){
                          continue;
                      }

                      if(d>maxDurationThreshold){
                          report({
                              p_lookup:entry.domainLookupEnd-entry.domainLookupStart,
                              p_tcp:entry.connectEnd-entry.connectStart,
                              p_ssl: entry.secureConnectionStart>0? (entry.connectEnd-entry.secureConnectionStart):0,
                              p_ttfb:entry.responseStart-entry.requestStart,
                              p_download:entry.responseEnd-entry.responseStart,
                              p_to_download:d,
                              p_to_connect:entry.connectEnd-entry.fetchStart,
                              url:entries[i].name
                          })
                      }
                  }
              });
              observer.observe({
                  entryTypes:observerEntryTypes
              });
          }
      }

      //页面性能监控
      var PagePerfMonitor={
          /**
           * 验证白名单
           * 暂时页面性能统计只在制定的白名单页面上报
           * @param whiteList {Array} [RegExp,RegExp]
           * @return {Boolean}
           */
          validate:function(whiteList){
              var pass=false;
              if(Utils.isArr(whiteList)){
                  whiteList.some(function(v,k){
                      if(Utils.isReg(v)){
                          if(v.test(location.href)){
                              pass=true;
                              return true;
                          }
                      }
                  })
              }
              else{
                  pass=whiteList==location.href;
              }

              return pass;
          },
          /**
           * 收集页面文档的性能数据
           */
          reportDocTiming:function(){
              report({
                  p_nav:timing.fetchStart-timing.navigationStart,
                  p_unload:timing.unloadEventEnd-timing.unloadEventStart,
                  p_lookup:timing.domainLookupEnd-timing.domainLookupStart,
                  p_tcp:timing.connectEnd-timing.connectStart,
                  p_ssl:(timing.secureConnectionStart>0?(timing.connectEnd-timing.secureConnectionStart):0),
                  p_ttfb:timing.responseStart-timing.requestStart,
                  p_download:timing.responseEnd-timing.responseStart,
                  p_to_download:timing.responseEnd-timing.navigationStart,
                  p_to_connect:timing.connectEnd-timing.navigationStart,
                  ext_req_part:1
              })
          },
          /**
           * 收集页面资源的性能数据
           */
          reportDocResourceTiming:function(){
              report({
                  p_dom_ready:timing.domComplete-timing.domLoading,
                  p_to_dom_ready:timing.domComplete-timing.navigationStart,
                  p_dom_loaded:timing.loadEventEnd-timing.loadEventStart,
                  p_to_dom_loaded:timing.loadEventEnd-timing.navigationStart,
                  ext_req_part:2
              })
          },
          init:function(whiteList){
              var me=this,
                  deferCall=function(){
                      if(document.readyState=="complete"){
                          setTimeout(function(){
                              me.reportDocResourceTiming();

                              document.removeEventListener("readystatechange",deferCall);
                          },100);
                      }
                  };

              if(!this.validate(whiteList)){
                  return;
              }

              me.reportDocTiming();

              if(document.readyState=="complete"){
                  me.reportDocResourceTiming();
              }
              else{
                  document.addEventListener("readystatechange",deferCall);
              }
          }
      }

      host["Perf"]={
          init:function(whiteList){
              PagePerfMonitor.init(whiteList);
              RequestMonitor.init();
          }
      }

  })(modules);
