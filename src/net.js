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
