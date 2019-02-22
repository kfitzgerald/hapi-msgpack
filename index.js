"use strict";

const MsgPack = require('msgpack-lite');
const Joi = require('joi');
const Hoek = require('hoek');
const Boom = require('boom');

const internals = {};

internals.mimeType = 'application/x-msgpack';
internals.decodeRegexp = null; // set on register

internals.optionsSchema = Joi.object().keys({
    mimeType: Joi.string().default(internals.mimeType)
}).default({ mimeType: internals.mimeType});

// c/o https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
internals.escapeRegExp = (val) => {
    return val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
};

/**
 * Hook to check if the request needs to be decoded as MessagePack
 * @param request
 * @param reply
 * @return {*}
 */
internals.onRequest = (request, reply) => {

    // Check if this request should be flagged for decoding
    if (internals.decodeRegexp.exec(request.headers['content-type'])) {

        // Flag for follow up in onPostAuth
        request._decodeAsMsgPack = true;

        // Intercept content-type so we can slip by subtext to avoid HTTP 415 unsupported media type errors
        request.headers['content-type'] = 'application/octet-stream';
    }

    return reply.continue();
};

/**
 * Hook to actually decode the payload as MessagePack, since subtext should have left us a nice Buffer to play with
 * @param request
 * @param reply
 * @return {*}
 */
internals.onPostAuth = (request, reply) => {

    // Check if this request was flagged for interception
    if (request._decodeAsMsgPack) {

        // Decode the payload if it's a buffer
        if (typeof request.payload === "object" && Buffer.isBuffer(request.payload)) {
            try {
                request.payload = MsgPack.decode(request.payload);
            } catch(e) {
                request.log(['error','msgpack','decode'], 'Failed to decode response payload');
                return reply(Boom.badRequest('Bad messagepack data'));
            }
        } else {
            request.log(['warning','msgpack','decode'], 'Did not decode response because payload was not a Buffer');
        }

        // Hide our crimes
        delete request._decodeAsMsgPack;
    }

    return reply.continue();
};

/**
 * Hook to rewrite response payloads in MessagePack
 * @param request
 * @param reply
 * @return {*}
 */
internals.onPreResponse = (request, reply) => {
    // Check if the client wants it in MessagePack
    const acceptType = request.raw.req.headers.accept;
    if (acceptType && internals.decodeRegexp.exec(acceptType)) {

        // Replace the response with one encoded in MessagePack
        const payload = MsgPack.encode(request.response.source);
        const response = reply(payload)
            .bytes(payload.length)
            .encoding('hex')
            .code(request.response.statusCode)
        ;

        // Copy original req headers
        Object.keys(request.response.headers).forEach((key) => {
            response.header(key, request.response.headers[key]);
        });

        // We have the final say on Content-Type
        response.type(internals.mimeType);

        return response;
    }
    return reply.continue();
};

/**
 * Register the Hapi-MessagePack Plugin
 * @param server
 * @param options
 * @param next
 * @return {*}
 */
exports.register = (server, options, next) => {

    // Confirm plugin configuration
    const result = Joi.validate(options, internals.optionsSchema);
    Hoek.assert(!result.error, 'Invalid', 'hapi-msgpack', 'options', result.error);
    internals.mimeType = result.value.mimeType;
    internals.decodeRegexp = new RegExp(`(${internals.escapeRegExp(internals.mimeType)})`, 'i');

    // Register hooks
    server.ext([{
        type: 'onRequest',
        method: internals.onRequest
    }, {
        type: 'onPostAuth',
        method: internals.onPostAuth
    }, {
        type: 'onPreResponse',
        method: internals.onPreResponse
    }]);

    return next();
};

exports.register.attributes = {

    pkg: require('./package.json')
};