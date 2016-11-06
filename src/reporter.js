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
