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
