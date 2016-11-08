# PageMonitor
页面运行期间性能、异常数据采集。
采集的数据统一上报到百度外卖日志平台，由内部其他服务消费日志产生报警或其他可视化数据展示。

## 使用方式
可以直接将代码**内联**到页面文档中，也可以通过**外联**引用。推荐使用**内联**的方式，但需要你考虑升级的不便。

无论使用内联或外联，监控代码应该放到`head`标签中所有`css`、`js`引用之前。

代码引入到文档后，可以通过以下方式初始化：

```javascript
/**
 * @param {Array} modules 引用的模块名称，根据需要引用指定的模块
 * net      网络监控模块，监控网络请求异常
 * perf     性能监控模块
 * runtime  JS运行时监控模块，监控JS运行时异常
 * @param {PlainObject} config 初始化配置
 * @param {Array}       whitelist 引用监控的页面url白名单
 */
window.BDWMMonitor.init(["net","perf","runtime"],{
    platform:"b",     //业务线
    app:"wmcrm",      //App名称
    channel:"pc"      //App类型、分类
},[/[^\?&]+[\?|&]qt=neworderlist&?/]);
```

### 基于FIS的smarty工程注意
在基于FIS的smarty工程中，内联引用的压缩后的JS代码单行长度有限制，应该使用构建后的`index.min.lw.js`作为内联代码。

## 指标定义

>参见内部wiki
- [异常指标](http://wiki.baidu.com/pages/viewpage.action?pageId=213667853)
- [性能指标](http://wiki.baidu.com/pages/viewpage.action?pageId=212853689)

## 如何监控性能数据
依赖浏览器提供的`Performance`API，有一定的浏览器兼容性要求，比如：不支持**<IE9**。
更多参考：[Performance Timing](https://w3c.github.io/performance-timeline/)

## 如何监控异常
异常分两种：**运行时异常**、**网络加载异常**

### 运行时异常
通过`window.addEventListener("error",function(){})`实现。
对于**跨域**的资源请求，需要对应的资源响应头中有`Access-Control-Allow-Origin`响应头标记当前页面域。
可以捕获更详细的脚本运行时错误。
对于脚本内容通过`try{}catch(){}`吃掉的异常将捕获不到。

### 网络加载异常
通过资源请求的`onload`、`onerror`监控加载成功或失败。
在FIS工程下，通过自定义扩展插件可以方便实现页面中所有的**js**、**css**请求被动态嵌入`onload`、`onerror`的hook。
