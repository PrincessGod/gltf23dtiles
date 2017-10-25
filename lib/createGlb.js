'use strict';
var fsExtra = require('fs-extra');
var gltfPipeline = require('gltf-pipeline');

var addPipelineExtras = gltfPipeline.addPipelineExtras;
var loadGltfUris = gltfPipeline.loadGltfUris;
var getBinaryGltf = gltfPipeline.getBinaryGltf;
module.exports = createGlb;

var sizeOfUint16 = 2;

/**
 * Create glb from glTF with _BATCHID per-mesh.
 * 
 * @param {Object} options Object with the following properties.
 * @param {String} options.gltf The gltf file path.
 * 
 * @returns {Promise} A promise that resolves with the binary glb buffer.
 */
function createGlb(options) {
    var gltfPath = options.gltf;
    return fsExtra.readJson(gltfPath)
        .then(function (gltf) {
            modifyGltf2WithBatchIds(gltf);
            return convertToBinaryGltf(gltf);
        });
}

function convertToBinaryGltf(gltf) {
    // return gltf;
    addPipelineExtras(gltf);
    return loadGltfUris(gltf)
        .then(function (gltf) {
            return getBinaryGltf(gltf, true, true).glb;
        });
}

function getBechIdState(gltf) {
    var i;
    var length;
    var id = 0;
    var batchIdState = {};
    var batchIdMeshState = [];
    var meshes = gltf.meshes;
    var accessors = gltf.accessors;
    for (var meshId in meshes) {
        if (meshes.hasOwnProperty(meshId)) {
            var primitives = meshes[meshId].primitives;
            length = primitives.length;
            var batchIdStateFrag = {
                name: meshes[meshId].name,
                meshId: id++,
                meshIdetify: meshId,
                maxVertexCount: 0,
            };
            for (i = 0; i < length; i++) {
                var primitive = primitives[i];
                var accessorsId = primitive.attributes.POSITION;
                var pointCount = accessors[accessorsId].count;
                if (batchIdStateFrag.maxVertexCount < pointCount) {
                    batchIdStateFrag.maxVertexCount = pointCount;
                }
            }
            batchIdMeshState.push(batchIdStateFrag);
        }
    }
    batchIdState['batchIdMeshState'] = batchIdMeshState;

    var batchIds = [];
    for (i = 0, length = batchIdMeshState.length; i < length; i++) {
        for (var j = 0; j < batchIdMeshState[i].maxVertexCount; j++) {
            batchIds.push(batchIdMeshState[i].meshId);
        }
    }
    batchIdState['batchIds'] = batchIds;

    var batchIdsLength = batchIds.length;
    var batchIdsBuffer = Buffer.alloc(batchIdsLength * sizeOfUint16);
    for (i = 0; i < batchIdsLength; i++) {
        batchIdsBuffer.writeUInt16LE(batchIds[i], i * sizeOfUint16);
    }
    var batchIdsBufferUri = 'data:application/octet-stream;base64,' + batchIdsBuffer.toString('base64');
    var batchIdSemantic = '_BATCHID';

    batchIdState.batchIdsLength = batchIdsLength;
    batchIdState.batchIdsBuffer = batchIdsBuffer;
    batchIdState.batchIdsBufferUri = batchIdsBufferUri;
    batchIdState.batchIdSemantic = batchIdSemantic;

    return batchIdState;
}

function modifyGltf1WithBatchIds(gltf) {
    var i;

    var batchIdState = getBechIdState(gltf);
    var batchIdMeshState = batchIdState.batchIdMeshState;
    var batchIdsBuffer = batchIdState.batchIdsBuffer;
    var batchIdsBufferUri = batchIdState.batchIdsBufferUri;
    var batchIdSemantic = batchIdState.batchIdSemantic;

    gltf.buffers.buffer_batchId = {
        name: 'buffer_batchId',
        type: 'arraubuffer',
        byteLength: batchIdsBuffer.length,
        uri: batchIdsBufferUri
    };

    gltf.bufferViews.bufferView_batchId = {
        name: 'bufferView_batchId',
        buffer: 'buffer_batchId',
        byteLength: batchIdsBuffer.length,
        byteOffset: 0,
        target: 34962 // ARRAY_BUFFER
    };

    var byteOffset = 0;
    for (i = 0; i < batchIdMeshState.length; i++) {
        var accessorsId = 'accessor_batchId_' + i;
        gltf.accessors[accessorsId] = {
            bufferView: 'bufferView_batchId',
            byteOffset: byteOffset,
            byteStride: 0,
            componentType: 5123, // UNSIGNED_SHORT
            count: batchIdMeshState[i].maxVertexCount,
            type: 'SCALAR',
            min: batchIdMeshState[i].meshId,
            max: batchIdMeshState[i].meshId
        };
        batchIdMeshState[i].accessorsId = accessorsId;
        byteOffset += batchIdMeshState[i].maxVertexCount * sizeOfUint16;
    }

    var meshes = gltf.meshes;
    for (i = 0; i < batchIdMeshState.length; i++) {
        var meshId = batchIdMeshState[i].meshIdetify;
        if (meshes.hasOwnProperty(meshId)) {
            var primitives = meshes[meshId].primitives;
            var length = primitives.length;
            for (var j = 0; j < length; j++) {
                var primitive = primitives[j];
                primitive.attributes[batchIdSemantic] = batchIdMeshState[i].accessorsId;
            }
        }
    }

    var programs = gltf.programs;
    for (var programId in programs) {
        if (programs.hasOwnProperty(programId)) {
            var program = programs[programId];
            program.attributes.push('a_batchId');
        }
    }

    var techniques = gltf.techniques;
    for (var techniqueId in techniques) {
        if (techniques.hasOwnProperty(techniqueId)) {
            var technique = techniques[techniqueId];
            technique.attributes.a_batchId = 'batchId';
            technique.parameters.batchId = {
                semantic: batchIdSemantic,
                type: 5123 // UNSIGNED_SHORT
            };
        }
    }

    var shaders = gltf.shaders;
    for (var shaderId in shaders) {
        if (shaders.hasOwnProperty(shaderId)) {
            var shader = shaders[shaderId];
            if (shader.type === 35633) { // Is a vertex shader
                var uriHeader = 'data:text/plain;base64,';
                var shaderEncoded = shader.uri.substring(uriHeader.length);
                var shaderText = Buffer.from(shaderEncoded, 'base64');
                shaderText = 'attribute float a_batchId;\n' + shaderText;
                shaderEncoded = Buffer.from(shaderText).toString('base64');
                shader.uri = uriHeader + shaderEncoded;
            }
        }
    }
}

function modifyGltf2WithBatchIds(gltf) {
    var i;
    var length;
    var accessors = gltf.accessors;
    var meshes = gltf.meshes;

    var batchIdState = getBechIdState(gltf);
    var batchIdMeshState = batchIdState.batchIdMeshState;
    var batchIdsBuffer = batchIdState.batchIdsBuffer;
    var batchIdsBufferUri = batchIdState.batchIdsBufferUri;
    var batchIdSemantic = batchIdState.batchIdSemantic;

    var batchIdsBufferId = gltf.buffers.length;
    gltf.buffers[batchIdsBufferId] = {
        byteLength: batchIdsBuffer.length,
        name: 'buffer_batchId',
        uri: batchIdsBufferUri
    };

    var batchIdsBufferViewsId = gltf.bufferViews.length;
    gltf.bufferViews[batchIdsBufferViewsId] = {
        buffer: batchIdsBufferId,
        byteLength: batchIdsBuffer.length,
        byteOffset: 0,
        name: 'bufferViews_batchId',
        target: 34962 // ARRAY_BUFFER
    };

    var batchIdsAccssorsBaseId = accessors.length;
    var byteOffset = 0;
    for (i = 0; i < batchIdMeshState.length; i++) {
        accessors[batchIdsAccssorsBaseId + i] = {
            bufferView: batchIdsBufferViewsId,
            byteOffset: byteOffset,
            byteStride: 0,
            componentType: 5123, // UNSIGNED_SHORT
            count: batchIdMeshState[i].maxVertexCount,
            type: 'SCALAR',
            min: batchIdMeshState[i].meshId,
            max: batchIdMeshState[i].meshId,
            name: 'accessor_buffer_batchId_' + batchIdMeshState[i].name
        };
        byteOffset += batchIdMeshState[i].count * sizeOfUint16;
        batchIdMeshState[i].accessorsId = batchIdsAccssorsBaseId + i;
    }

    for (i = 0; i < batchIdMeshState.length; i++) {
        var meshId = batchIdMeshState[i].meshId;
        var primitives = meshes[meshId].primitives;
        length = primitives.length;
        for (var k = 0; k < length; k++) {
            var primitive = primitives[k];
            primitive.attributes[batchIdSemantic] = batchIdMeshState[i].accessorsId;
        }
    }

}
