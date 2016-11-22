~(function(win,src,name){
    var script = document.createElement('script');
    var firstScript = document.getElementsByTagName('script')[0];
    script.async = true;
    script.src = src;
    firstScript.parentNode.insertBefore(script,firstScript);
    win[name] = function () {
        (win[name].q = win[name].q || []).push(arguments);
    };
})(window,'../dist/pageMonitor-lite-0.2.min.js','BDWMMonitor')
