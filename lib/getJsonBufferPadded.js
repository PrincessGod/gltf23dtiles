'use strict';

var Cesium = require('Cesium');

var defaultValue = Cesium.defaultValue;
var defined      = Cesium.defined;

module.exports = getJsonBufferPadded;

/**
 * Convert the JSON object to buffer have proper padding.
 * 
 * Pad the JSON with extra whitespace to fit next 8-byte boundary.
 * 
 * @param {Object} [json] The JSON object.
 * @param {Number} [byteOffset=0] The byte offset on which the buffer starts.
 * @returns {Buffer} The padded Json buffer.
 */
function getJsonBufferPadded(json, byteOffset) {
    if (!defined(json)) {
        return Buffer.alloc(0);
    }

    byteOffset = defaultValue(byteOffset, 0);
    var string = JSON.stringify(json);

    var boundary   = 8;
    var byteLength = Buffer.byteLength(string);
    var remainder  = (byteOffset + byteLength) % boundary;
    var padding    = (remainder === 0) ? 0: boundary - remainder;
    var whitespace = '';
    for (var i = 0; i < padding; ++i) {
        whitespace += ' ';
    }
    string += whitespace;

    return Buffer.from(string);
}
