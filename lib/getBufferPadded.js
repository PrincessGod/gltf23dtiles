'use strict';

var Cesium = require('Cesium');

var defaultValue = Cesium.defaultValue;
var defined      = Cesium.defined;

module.exports = getBufferPadded;

/**
 * Pad the buffer to the next 8-byte boundary to enure proper alignment for the section
 * that follows.
 * 
 * @param {Buffer} buffer The buffer.
 * @param {Buffer} [byteOffset=0] The byte offset on which the buffer starts.
 * @returns {Buffer} The padded buffer.
 */
function getBufferPadded(buffer, byteOffset) {
    if (!defined(buffer)) {
        return Buffer.alloc(0);
    }

    byteOffset = defaultValue(byteOffset, 0);

    var boundary    = 8;
    var byteLength  = buffer.length;
    var remainder   = (byteOffset + byteLength) % boundary;
    var padding     = (remainder === 0) ? 0: boundary - remainder;
    var emptyBuffer =  Buffer.alloc(padding);
    return Buffer.concat([buffer, emptyBuffer]);
}
