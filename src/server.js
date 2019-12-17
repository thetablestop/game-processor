import express from 'express';
import cors from 'cors';
import http from 'http';
import bodyParser from 'body-parser';
import { HelloService } from './hello-service.js';

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
    });

const port = process.env.NODE_PORT || 3000;
httpServer.listen(port);
console.log(`Listening on http://localhost:${port}`);

// Setup routes
router.get('/test', async (req, res) => {
    try {
        const svc = new HelloService();
        res.send(svc.sayHi(`${req.protocol}://${req.hostname}:${req.socket.localPort}/api/test`));
    } catch (err) {
        console.err(err);
        res.sendStatus(500);
    }
});
