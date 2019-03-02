"use strict";

const should = require('should');
const Hapi = require('hapi');
const Needle = require('needle');
const MsgPack = require('msgpack-lite');
const Joi = require('joi');

describe('hapi-msgpack', () => {

    describe('registration', () => {

        it('should register with hapi with default options', async () => {
            const server = new Hapi.Server();
            const plugin = {
                plugin: require('../index'),
                options: {}
            };
            await server.register(plugin);
        });

        it('should register with hapi with set options', async () => {
            const server = new Hapi.Server();
            const plugin = {
                plugin: require('../index'),
                options: {
                    mimeType: 'application/x-my-custom-type'
                }
            };
            await server.register(plugin);
        });

    });

    const coreTests = (msgPackMimeType = 'application/x-msgpack') => {
        return () => {

            const server = new Hapi.Server();
            const plugin = {
                plugin: require('../index'),
                options: {
                    mimeType: msgPackMimeType
                }
            };

            before(async () => {

                await server.register(plugin);

                server.route({
                    method: 'GET',
                    path: '/basic-response',
                    handler: (/*request, handler*/) => {
                        return {
                            str: "string",
                            num: 42,
                            nope: null,
                            arr: [1,"2",3]
                        };
                    },
                    config: {

                    }
                });

                // noinspection JSUnusedGlobalSymbols
                server.route({
                    method: 'POST',
                    path: '/basic-input',
                    handler: (request, h) => {

                        should(request.payload).deepEqual({
                            str: "string",
                            num: 42,
                            nope: null,
                            arr: [1, "2", 3]
                        });

                        return h.response({
                            statusCode: 200,
                            error: null,
                            data: {
                                received: true
                            }
                        }).header('x-custom-header', 'absolutely i do')
                    },
                    config: {
                        validate: {
                            payload: {
                                str: Joi.string(),
                                num: Joi.number(),
                                nope: Joi.any(),
                                arr: Joi.array().items(Joi.any())
                            },
                            failAction: async (request, h, err) => {
                                throw err;
                            }
                        }
                    }
                });

                await server.start();
            });

            after(async () => {
                await server.stop();
            });

            it('should return responses as JSON', (done) => {
                Needle.request('get', server.info.uri+'/basic-response', {}, {}, (err, res) => {
                    should(err).not.be.ok();
                    should(res).be.ok();

                    res.headers['content-type'].should.be.exactly('application/json; charset=utf-8');
                    should(res.body).be.ok();
                    const data = res.body;
                    data.should.deepEqual({
                        str: "string",
                        num: 42,
                        nope: null,
                        arr: [1,"2",3]
                    });

                    done();
                });
            });

            it('should return responses as MessagePack', (done) => {
                Needle.request('get', server.info.uri+'/basic-response', {}, { accept: msgPackMimeType}, (err, res) => {
                    should(err).not.be.ok();
                    should(res).be.ok();

                    res.statusCode.should.be.exactly(200);
                    res.headers['content-type'].should.be.exactly(msgPackMimeType);
                    res.body.should.be.instanceOf(Buffer);

                    // Decode it to verify
                    const data = MsgPack.decode(res.body);
                    should(data).be.ok();

                    data.should.deepEqual({
                        str: "string",
                        num: 42,
                        nope: null,
                        arr: [1,"2",3]
                    });

                    done();
                });
            });

            it('should post payloads as JSON, receive as JSON', (done) => {
                Needle.request('post', server.info.uri+'/basic-input', {
                    str: "string",
                    num: 42,
                    nope: null,
                    arr: [1,"2",3]
                }, { json: true }, (err, res) => {
                    should(err).not.be.ok();
                    should(res).be.ok();

                    res.statusCode.should.be.exactly(200);
                    res.headers['content-type'].should.be.exactly('application/json; charset=utf-8');
                    res.headers['x-custom-header'].should.be.exactly('absolutely i do');

                    should(res.body).be.ok();
                    const data = res.body.data;
                    data.received.should.be.exactly(true);

                    done();
                });
            });

            it('should post payloads as MessagePack, receive as JSON', (done) => {
                const payload = MsgPack.encode({
                    str: "string",
                    num: 42,
                    nope: null,
                    arr: [1,"2",3]
                });
                Needle.request('post', server.info.uri+'/basic-input', payload, { content_type: msgPackMimeType }, (err, res) => {
                    should(err).not.be.ok();
                    should(res).be.ok();

                    res.statusCode.should.be.exactly(200);
                    res.headers['content-type'].should.be.exactly('application/json; charset=utf-8');
                    res.headers['x-custom-header'].should.be.exactly('absolutely i do');

                    should(res.body).be.ok();
                    const data = res.body.data;
                    data.received.should.be.exactly(true);

                    done();
                });
            });

            it('should post payloads as MessagePack, receive as MessagePack', (done) => {
                const payload = MsgPack.encode({
                    str: "string",
                    num: 42,
                    nope: null,
                    arr: [1,"2",3]
                });
                Needle.request('post', server.info.uri+'/basic-input', payload, {
                    content_type: msgPackMimeType,
                    accept: msgPackMimeType
                }, (err, res) => {
                    should(err).not.be.ok();
                    should(res).be.ok();

                    res.statusCode.should.be.exactly(200);
                    res.headers['content-type'].should.be.exactly(msgPackMimeType);
                    res.headers['x-custom-header'].should.be.exactly('absolutely i do');

                    should(res.body).be.ok();
                    const body = MsgPack.decode(res.body);
                    body.data.received.should.be.exactly(true);

                    done();
                });
            });

            it('should handle bad MessagePack payloads', (done) => {

                let gotErrorEvent = false;
                server.events.once('request', (request, event/*, tags*/) => {
                    try {
                        event.tags.should.containDeepOrdered(['error', 'msgpack', 'decode']);
                        event.data.should.match(/Failed to decode/);
                        gotErrorEvent = true;
                    } catch (e) {
                        /* eslint-disable no-console */
                        console.error(e);
                    }
                });

                let payload = MsgPack.encode("string");
                payload = payload.slice(0, payload.length-2); // two bytes too short!
                Needle.request('post', server.info.uri+'/basic-input', payload, { content_type: msgPackMimeType }, (err, res) => {
                    should(err).not.be.ok();
                    should(res).be.ok();

                    res.statusCode.should.be.exactly(400);
                    res.headers['content-type'].should.be.exactly('application/json; charset=utf-8');

                    should(res.body).be.ok();
                    const body = res.body;
                    body.statusCode.should.be.exactly(400);
                    body.error.should.be.exactly('Bad Request');
                    body.message.should.be.exactly('Bad messagepack data');

                    gotErrorEvent.should.be.exactly(true);
                    done();
                });
            });

            it('should handle empty payloads', (done) => {

                let gotWarningEvent = false;
                server.events.once('request', (request, event/*, tags*/) => {
                    try {
                        event.tags.should.containDeepOrdered(['warning', 'msgpack', 'decode']);
                        event.data.should.match(/Did not decode/);
                        gotWarningEvent = true;
                    } catch (e) {
                        /* eslint-disable no-console */
                        console.error(e);
                    }
                });

                Needle.request('post', server.info.uri+'/basic-input', "", { content_type: msgPackMimeType }, (err, res) => {
                    should(err).not.be.ok();
                    should(res).be.ok();

                    res.statusCode.should.be.exactly(400);
                    res.headers['content-type'].should.be.exactly('application/json; charset=utf-8');

                    should(res.body).be.ok();
                    const body = res.body;
                    body.statusCode.should.be.exactly(400);
                    body.error.should.be.exactly('Bad Request');
                    body.message.should.match(/must be an object/);

                    // We should also have gotten the warning that there was nothing to decode
                    gotWarningEvent.should.be.exactly(true);
                    done();
                });
            });

        }
    };

    describe('basic functionality', coreTests());

    describe('custom mimeType', coreTests('application/x-custom-msgpack'));

    describe('preEncode hooks', () => {

        const server = new Hapi.Server();
        const plugin = {
            plugin: require('../index'),
            options: {
                preEncode: (payload) => {
                    // Basic example that wraps the original payload
                    return {
                        originalPayload: payload,
                        something: "completely",
                        different: true
                    };
                }

            }
        };

        before(async () => {

            await server.register(plugin);

            // noinspection JSUnusedGlobalSymbols
            server.route({
                method: 'POST',
                path: '/basic-input',
                handler: (request, h) => {

                    should(request.payload).deepEqual({
                        str: "string",
                        num: 42,
                        nope: null,
                        arr: [1, "2", 3]
                    });

                    return h.response({
                        statusCode: 200,
                        error: null,
                        data: {
                            received: true
                        }
                    }).header('x-custom-header', 'absolutely i do')
                },
                config: {
                    validate: {
                        payload: {
                            str: Joi.string(),
                            num: Joi.number(),
                            nope: Joi.any(),
                            arr: Joi.array().items(Joi.any())
                        },
                        failAction: async (request, h, err) => {
                            throw err;
                        }
                    }
                }
            });

            await server.start();
        });

        after(async () => {
            await server.stop();
        });

        it('should fire before encoding response', (done) => {
            const msgPackMimeType = 'application/x-msgpack';
            const payload = MsgPack.encode({
                str: "string",
                num: 42,
                nope: null,
                arr: [1,"2",3]
            });
            Needle.request('post', server.info.uri+'/basic-input', payload, {
                content_type: msgPackMimeType,
                accept: msgPackMimeType
            }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.statusCode.should.be.exactly(200);
                res.headers['content-type'].should.be.exactly(msgPackMimeType);
                res.headers['x-custom-header'].should.be.exactly('absolutely i do');

                should(res.body).be.ok();
                const body = MsgPack.decode(res.body);
                body.should.deepEqual({
                    originalPayload: {
                        statusCode: 200,
                        error: null,
                        data: { received: true } // <-- all wrapped up nice
                    },
                    something: 'completely',
                    different: true
                });

                done();
            });
        });

    });

});