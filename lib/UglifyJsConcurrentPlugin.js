/**
 * @author "Evgeny Reznichenko" <kusakyky@gmail.com>
 *
 *     Модифицированная версия стандартного UglifyJsPlugin
 *     Умеет рабоать в несколько потоков и работать с кешем
 */
var
    SourceMapConsumer = require('webpack-core/lib/source-map').SourceMapConsumer,
    SourceMapSource = require('webpack-core/lib/SourceMapSource'),
    RawSource = require('webpack-core/lib/RawSource'),
    RequestShortener = require('webpack/lib/RequestShortener'),
    ModuleFilenameHelpers = require('webpack/lib/ModuleFilenameHelpers'),

    consts = require('./const'),
    async = require('async'),
    UglifyJsProc = require('./UglifyJsProc'),

    procCache = [];

function UglifyJsConcurrentPlugin(options) {
    if(typeof options !== 'object') options = {};
    if(typeof options.compressor !== 'undefined') {
        options.compress = options.compressor;
    }

    options.test = options.test || /\.js($|\?)/i;
    options.concurrentLimit = 2;

    this.options = options;
}
module.exports = UglifyJsConcurrentPlugin;

UglifyJsConcurrentPlugin.prototype.apply = function(compiler) {
    var
        options = this.options,
        requestShortener = new RequestShortener(compiler.context);

    compiler.plugin('compilation', function(compilation) {

        if(options.sourceMap !== false) {
            compilation.plugin('build-module', function(module) {
                module.useSourceMap = true;
            });
        }

        compilation.plugin('optimize-chunk-assets', function(chunks, callback) {
            var
                files = [];

            chunks.forEach(function(chunk) {
                chunk.files.forEach(function(file) {
                    files.push(file);
                });
            });

            compilation.additionalChunkAssets.forEach(function(file) {
                files.push(file);
            });

            files = files.filter(ModuleFilenameHelpers.matchObject.bind(undefined, options));

            async.eachLimit(files, options.concurrentLimit, function(file, next) {
                var
                    asset = compilation.assets[file],
                    proc, sourceAndMap, inputSourceMap, input, sourceMap, onWarnFunction,
                    warnings = [];

                if (asset.__UglifyJsPlugin) {
                    compilation.assets[file] = asset.__UglifyJsPlugin;
                    return next();
                }

                if(options.sourceMap !== false) {

                    if(asset.sourceAndMap) {
                        sourceAndMap = asset.sourceAndMap();
                        inputSourceMap = sourceAndMap.map;
                        input = sourceAndMap.source;
                    } else {
                        inputSourceMap = asset.map();
                        input = asset.source();
                    }

                    sourceMap = new SourceMapConsumer(inputSourceMap);

                    onWarnFunction = function(warning) {
                        var
                            match = /\[.+:([0-9]+),([0-9]+)\]/.exec(warning),
                            line = +match[1],
                            column = +match[2],
                            original = sourceMap.originalPositionFor({
                                line: line,
                                column: column
                            });

                        if (!original || !original.source || original.source === file) {
                            return;
                        }

                        warnings.push(warning.replace(/\[.+:([0-9]+),([0-9]+)\]/, "") +
                            "[" + requestShortener.shorten(original.source) + ":" + original.line + "," + original.column + "]");
                    };

                } else {
                    input = asset.source();

                    onWarnFunction = function(warning) {
                        warnings.push(warning);
                    };
                }

                proc = new UglifyJsProc();
                procCache.push(proc);

                proc.on(consts.MSG_WARNING, function (ev) {
                    onWarnFunction(ev.warning);
                });

                proc.on(consts.MSG_ERROR, function (ev) {
                    var
                        err = ev.error,
                        original;

                    if (err.line) {
                        original = sourceMap && sourceMap.originalPositionFor({
                                line: err.line,
                                column: err.col
                        });

                        if (original && original.source) {
                            compilation.errors.push(new Error(file + ' from UglifyJs\n' + err.message + ' [' + requestShortener.shorten(original.source) + ':' + original.line + ',' + original.column + ']'));
                        } else {
                            compilation.errors.push(new Error(file + ' from UglifyJs\n' + err.message + ' [' + file + ':' + err.line + ',' + err.col + ']'));
                        }
                    } else if (err.msg) {
                        compilation.errors.push(new Error(file + ' from UglifyJs\n' + err.msg));
                    } else {
                        compilation.errors.push(new Error(file + ' from UglifyJs\n' + err.stack));
                    }
                });

                proc.on(consts.MSG_DONE, function (ev) {
                    var
                        index = procCache.indexOf(proc);

                    if (~index) {
                        procCache.splice(index, 1);
                    }

                    proc.free();

                    asset.__UglifyJsPlugin = compilation.assets[file] = (ev.map ?
                        new SourceMapSource(ev.stream, file, JSON.parse(ev.map), input, inputSourceMap) :
                        new RawSource(ev.stream));
                    if(warnings.length > 0) {
                        compilation.warnings.push(new Error(file + ' from UglifyJs\n' + warnings.join('\n')));
                    }

                    next();
                });

                proc.exec({ input: input, options: options, file: file });

            }, function () {
                callback();
            });
        });

        compilation.plugin('normal-module-loader', function(context) {
            context.minimize = true;
        });
    });
};

process.on('exit', function () {
    procCache.forEach(function (proc) {
        proc.free();
    });
});
