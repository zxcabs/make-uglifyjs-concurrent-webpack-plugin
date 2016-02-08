/**
 * @author "Evgeny Reznichenko" <kusakyky@gmail.com>
 */
var
    UglifyJsConcurrentPlugin = require('./');

module.exports = {
    entry: {
        index: __dirname + '/example/one/src/index.js'
    },
    output: {
        path: __dirname + '/example/one//output/',
        filename: '[name].js'
    },
    plugins: [
        new UglifyJsConcurrentPlugin({
            //see: https://github.com/mishoo/UglifyJS2#compressor-options
            compressor: {
                sequences: true,
                properties: true,
                dead_code: true,
                drop_debugger: true,
                unsafe: false,
                conditionals: true,
                comparisons: true,
                evaluate: true,
                booleans: true,
                loops: true,
                unused: false,
                hoist_funs: true,
                hoist_vars: false,
                if_return: true,
                join_vars: true,
                cascade: true,
                warnings: true,
                negate_iife: true,
                pure_getters: false,
                pure_funcs: null,
                drop_console: false,
                keep_fargs: false
            }
        })
    ]
};
