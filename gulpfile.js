var gulp = require("gulp")
var gulpInclude = require("gulp-include");
var gulpUglify = require("gulp-uglify");
var gulpRename = require("gulp-rename");
var gulpConcat = require("gulp-concat");
var del = require("del");
var pump = require('pump');
var ver = require('./package.json').version;
var DEST = "./dist/";


gulp.task("clean", function () {
    del(["./dist/**/*"])
});
gulp.task('all',function(cb) {
    pump([
            gulp.src(['./src/index.js','./src/net.js','./src/exception.js','./src/perf.js']),
            gulpConcat('pageMonitor-all.js'),
            gulp.dest(DEST),
            gulpUglify(),
            gulpRename({
                extname: "-" + ver +".min.js"
            }),
            gulp.dest(DEST)
        ],cb);
});

gulp.task('lite',function(cb){
    pump([
        gulp.src(['./src/exception.js','./src/net-lite.js','./src/perf.js','./src/index.js']),
        gulpConcat('pageMonitor-lite.js'),
        gulp.dest(DEST),
        gulpUglify({
            // output: {
            //     max_line_len: 800
            // }
        }),
        gulpRename({
            extname: "-" + ver +".min.js"
        }),
        gulp.dest(DEST)
    ],cb);
});
gulp.task('exception',function(cb){
    pump([
        gulp.src(['./src/index.js','./src/exception.js']),
        gulpConcat('pageMonitor-exception.js'),
        gulp.dest(DEST),
        gulpUglify(),
        gulpRename({
            extname: "-" + ver + ".min.js"
        }),
        gulp.dest(DEST)
    ],cb);
});
gulp.task('deploy', function(cb){
    pump([
        gulp.src(['./src/deploy.js']),
        gulpConcat('deploy.js'),
        gulp.dest(DEST),
        gulpUglify(),
        gulp.dest(DEST)
    ],cb);
});
gulp.task("default", ['clean',"all",'lite','exception','deploy']);
