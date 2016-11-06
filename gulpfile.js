var gulp = require("gulp")
var gulpInclude = require("gulp-include")
var gulpUglify=require("gulp-uglify")
var del=require("del")

gulp.task("concat",["clean"], function () {
    gulp.src("./src/index.js")
        .pipe(gulpInclude({
            extensions: "js",
            includePaths: [
                __dirname + "/src"
            ]
        }))
        .pipe(gulpUglify({
            output:{
                max_line_len:800
            }
        }))
        .pipe(gulp.dest("./dist/"))
})

gulp.task("clean",function(){
    del(["./dist/**/*"])
})

gulp.task("default", ["concat"])