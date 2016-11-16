
~(function(win){
    var BDWMMonitor = win.BDWMMonitor ;
    var location = window.location;
    BDWMMonitor.define('exception', function(){
        return {
            run : function(){
                this.catchException();
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
            }
        }
    })
})(window);
