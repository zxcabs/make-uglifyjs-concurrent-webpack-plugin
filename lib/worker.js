/**
 * @author "Evgeny Reznichenko" <kusakyky@gmail.com>
 */
var
    uglify = require('uglify-js'),
    consts = require('./const'),
    assign = require('object-assign');

process.once('message', function (ev) {
    if (ev.name === consts.MSG_START) {
        var
            compress, map, stream;

        try {
            var
                options = ev.options || {},
                ast,
                output = {};

            uglify.AST_Node.warn_function = function (warning) {
                process.send({ name: consts.MSG_WARNING, warning: warning });
            };

            ast = uglify.parse(ev.input, {
                filename: ev.file
            });

            if (options.compress !== false) {
                ast.figure_out_scope();
                compress = uglify.Compressor(options.compress);
                ast = ast.transform(compress);
            }

            if (options.mangle !== false) {
                ast.figure_out_scope();
                ast.compute_char_frequency(options.mangle || {});
                ast.mangle_names(options.mangle || {});
            }

            output.comments = options.comments || /^\**!|@preserve|@license/;
            output.beautify = options.beautify;
            output = assign(output, options.output || {});

            if (options.sourceMap !== false) {

                map = uglify.SourceMap({
                    file: ev.file,
                    root: ""
                });

                output.source_map = map;
            }

            stream = uglify.OutputStream(output);
            ast.print(stream);

            if (map) {
                map = map + "";
            }

            stream = stream + "";
        } catch (error) {
            process.send({ name: consts.MSG_ERROR, error: error });
        } finally {
            process.send({ name: consts.MSG_DONE, stream: stream, map: map });
        }
    }
});
