import express from 'express';
import cors from 'cors';
import http from 'http';
import bodyParser from 'body-parser';
import amqp from 'amqplib';
import axios from 'axios';
import * as awilix from 'awilix';
import { MongoClient } from 'mongodb';
import { GameService } from './services/game-service.js';
import { GameSourcesService } from './services/game-sources-service.js';
import { GameSourcesController } from './controllers/game-sources-controller.js';
import { GameProcessService } from './services/game-process-service.js';

const container = awilix.createContainer({
    injectionMode: awilix.InjectionMode.PROXY
});

container.register({
    mongodbProvider: awilix.asFunction(() => {
        if (!process.env.MONGODB_CONNECTION) {
            throw new Error('An environment variable MONGODB_CONNECTION is required with the value of the db connection string.');
        }
        return {
            connect: async () => {
                return new Promise((res, rej) => {
                    MongoClient.connect(
                        process.env.MONGODB_CONNECTION,
                        {
                            useUnifiedTopology: true
                        },
                        (err, client) => {
                            if (err) rej(err);
                            else {
                                res(client.db(process.env.MONGODB_NAME || 'database'));
                            }
                        }
                    );
                });
            }
        };
    }),
    pubSubQueueProvider: awilix.asFunction(() => {
        if (!process.env.RABBITMQ_PUBSUB_CONNECTION) {
            throw new Error(
                'An environment variable RABBITMQ_PUBSUB_CONNECTION is required with the value of the queue connection string.'
            );
        }
        return {
            connect: async () => {
                const conn = await amqp.connect(process.env.RABBITMQ_PUBSUB_CONNECTION);
                const ch = await conn.createChannel();
                ch.prefetch(1); // Only grab one message at a time. I don't think this works though
                return ch;
            }
        };
    }),
    gameSourcesController: awilix.asClass(GameSourcesController).scoped(),
    gameProcessService: awilix.asClass(GameProcessService).singleton(),
    gameService: awilix.asClass(GameService).scoped(),
    gameSourcesService: awilix.asClass(GameSourcesService).scoped()
});

const app = express();
const router = express.Router();
const httpServer = http.createServer(app);
app.use(bodyParser.urlencoded({ extended: true }))
    .use(
        cors({
            origin: process.env.ORIGINS || '*'
        })
    )
    .use(bodyParser.json())
    .use('/api', router)
    .get('/', (req, res) => {
        const pkg = require('../package.json');
        res.send(`<h1>${pkg.name}</h1>
        <h2>Version: ${pkg.version}</h2>`);
    })
    .get('/status', async (req, res) => {
        let result = `Poller Task: ${container.cradle.gameProcessService.paused ? 'Paused' : 'Active'}<br />`;
        try {
            await container.cradle.mongodbProvider.connect();
            result += 'DB connection: Successful<br />';
        } catch (err) {
            result += `DB connection: Error: ${err}<br />`;
        }

        try {
            var channel = await container.cradle.pubSubQueueProvider.connect();
            if (channel) {
                result += 'Queue channel connection: Successful<br />';
            } else {
                result += 'Queue channel connection: Failed<br />';
            }
            channel.close();
        } catch (err) {
            result += `Queue channel connection: ${err}<br />`;
        }
        res.send(result);
    });

const port = process.env.NODE_PORT || 3004;
httpServer.listen(port);
console.log(`Listening on http://localhost:${port}`);

// Run main neverending process
container.cradle.gameProcessService.process();

// Setup routes
router
    .use(async (req, res, next) => {
        // create a scoped container
        req.scope = container.createScope();
        // check auth header and verify they are in the org to register a logged in user
        try {
            const userRes = await axios.get('https://api.github.com/user', {
                headers: {
                    Authorization: req.header('Authorization')
                }
            });

            if (userRes.data && userRes.data.login) {
                const orgRes = await axios.get('https://api.github.com/user/orgs', {
                    headers: {
                        Authorization: req.header('Authorization')
                    }
                });
                if (orgRes.data && orgRes.data.length && orgRes.data[0].login === 'thetablestop') {
                    req.user = userRes.data;
                }
            }
        } catch (err) {
            console.error(`User not authorized with header: ${req.headers.Authorization}`);
        }

        req.scope.register({
            currentUser: awilix.asValue(req.user)
        });
        next();
    })
    .get('/source', async (req, res) => await req.scope.resolve('gameSourcesController').getAll(req, res))
    .get('/source/:name', async (req, res) => await req.scope.resolve('gameSourcesController').find(req, res))
    .delete('/source/:name', async (req, res) => await req.scope.resolve('gameSourcesController').delete(req, res))
    .post('/source', async (req, res) => await req.scope.resolve('gameSourcesController').insert(req, res))
    .patch('/source', async (req, res) => await req.scope.resolve('gameSourcesController').update(req, res));
