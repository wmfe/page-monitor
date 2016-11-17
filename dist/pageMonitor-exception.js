(function (win) {
    var BDWMMonitor = win.BDWMMonitor;
    var location = window.location;
    BDWMMonitor.define('exception', function () {
        return {
            run: function () {
                this.catchException();
            },
            catchException: function () {
                window.onerror = function (msg, url, line, col, error) {
                    var newMsg = msg;
                    if (error && error.stack) {
                        newMsg = _processStackMsg(error);
                    }
                    BDWMMonitor.report('exception', {
                        tag: 'js_error',
                        err_txt: newMsg,
                        url: url,
                        purl: location.href,
                        ln: line,
                        col: col,
                        err_status: 401
                    })
                };

                function _processStackMsg(error) {
                    var stack = error.stack
                        .replace(/\n/gi, "")
                        .split(/\bat\b/)
                        .slice(0, 9)
                        .join("@")
                        .replace(/\?[^:]+/gi, "");
                    var msg = error.toString();
                    if (stack.indexOf(msg) < 0) {
                        stack = msg + "@" + stack;
                    }
                    return stack;
                }
            }
        }
    })
})(window);
