var gulp = require("gulp")
var gulpInclude = require("gulp-include")
var gulpUglify=require("gulp-uglify")
var gulpRename = require("gulp-rename")
var del=require("del")

var DEST="./dist/"

gulp.task("concat",["clean"], function () {
    gulp.src("./src/index.js")
        .pipe(gulpInclude({
            extensions: "js",
            includePaths: [
                __dirname + "/src"
            ]
        }))
        .pipe(gulp.dest(DEST))
        .pipe(gulpUglify())
        .pipe(gulpRename({
            extname:".min.js"
        }))
        .pipe(gulp.dest(DEST))
        .pipe(gulpUglify({
            output:{
                max_line_len:800
            }
        }))
        .pipe(gulpRename({
            extname:".lw.js"
        }))
        .pipe(gulp.dest(DEST))
})

gulp.task("clean",function(){
    del(["./dist/**/*"])
})

gulp.task("default", ["concat"])