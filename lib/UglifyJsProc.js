/**
 * @author "Evgeny Reznichenko" <kusakyky@gmail.com>
 */
var
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    fork = require('child_process').fork,
    assign = require('object-assign'),
    consts = require('./const');


function UglifyProc() {
    EventEmitter.call(this);

    this._ch = fork(__dirname + '/worker.js');

    this._ch.on('message', UglifyProc._onMessage.bind(this));
}

module.exports = UglifyProc;

util.inherits(UglifyProc, EventEmitter);

UglifyProc._onMessage = function (ev) {
    this.emit(ev.name, ev);
};

UglifyProc.prototype.exec = function (data) {
    this._ch.send(assign({}, data, { name: consts.MSG_START }));
};

UglifyProc.prototype.free = function () {
    this._ch.removeAllListeners('message');
    this._ch.kill();
};
