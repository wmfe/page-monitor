!(function(win,src){
    function set(){
        var script = document.createElement('script');
        var firstScript = document.getElementsByTagName('script')[0];
        script.async = true;
        script.src = src;
        firstScript.parentNode.insertBefore(script,firstScript);
    }
    if(win.addEventListener){
        win.addEventListener('load',set,false);
    }else if (win.attachEvent){
        win.attachEvent('onload',set);
    }else {
        win.onload = function(){
            set();
        }
    }
})(window,'../dist/pageMonitor-lite-0.2.lw.js')
