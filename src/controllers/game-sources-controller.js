export class GameSourcesController {
    constructor({ gameSourcesService, currentUser }) {
        this.service = gameSourcesService;
        this.user = currentUser;
    }

    async getAll(req, res) {
        try {
            res.send(await this.service.getAll());
        } catch (err) {
            console.error(err);
            res.sendStatus(500);
        }
    }

    async find(req, res) {
        try {
            res.send(await this.service.find(req.params.name));
        } catch (err) {
            console.error(err);
            res.sendStatus(500);
        }
    }

    async insert(req, res) {
        try {
            if (!this.user) {
                res.sendStatus(401);
                return;
            }

            if (!req.body.name || !req.body.url || !req.body.linkSelector || !req.body.nextPageSelector) {
                res.status(400).send('The following fields are rquired: name, url, linkSelector, nextPageSelector');
                return;
            }
            const exists = await this.service.find(req.body.name);
            if (exists) {
                res.status(400).send(`The source for ${req.body.name} already exists`);
                return;
            }

            await this.service.insert(req.body);
            res.set('Location', `${req.protocol}://${req.hostname}:${req.socket.localPort}/api/source/${req.body.name}`);
            res.sendStatus(201);
        } catch (err) {
            console.error(err);
            res.sendStatus(500);
        }
    }

    async update(req, res) {
        try {
            if (!this.user) {
                res.sendStatus(401);
                return;
            }

            if (!req.body.name) {
                res.status(400).send('The following fields are rquired: name');
                return;
            }
            const exists = await this.service.find(req.body.name);
            if (!exists) {
                res.status(400).send(`The source for ${req.body.name} does not exist`);
                return;
            }

            await this.service.update(req.body);
            res.sendStatus(200);
        } catch (err) {
            console.error(err);
            res.sendStatus(500);
        }
    }

    async delete(req, res) {
        try {
            if (!this.user) {
                res.sendStatus(401);
                return;
            }

            if (!req.params.name) {
                res.status(400).send('The following fields are rquired: name');
                return;
            }
            const exists = await this.service.find(req.params.name);
            if (!exists) {
                res.status(400).send(`The source for ${req.params.name} does not exist`);
                return;
            }

            await this.service.delete(req.params.name);
            res.sendStatus(200);
        } catch (err) {
            console.error(err);
            res.sendStatus(500);
        }
    }
}
