import axios from 'axios';
import url from 'url';
import chalk from 'chalk';

export class GameParseService {
    constructor({ gameService, gameSourcesService, pubSubQueueProvider }) {
        this.paused = false;
        this.gameService = gameService;
        this.gameSourceService = gameSourcesService;
        this.queue = pubSubQueueProvider;
        this.gamesQueueName = process.env.GAMES_QUEUE || 'games';
        const host = process.env.HTML_SCRAPER_SERVICE_HOST || 'localhost';
        const port = process.env.HTML_SCRAPER_SERVICE_PORT || 3002;
        this.scraperBaseUrl = `http://${host}:${port}/api/`;
    }

    async getQueuedGame() {
        const ch = await this.queue.connect();
        const hasQ = await ch.assertQueue(this.gamesQueueName);
        if (hasQ) {
            return ch.consume(this.gamesQueueName, msg => {
                if (msg !== null) {
                    const entity = JSON.parse(msg.content);
                    ch.ack(msg);
                    return entity;
                }
            });
        }
    }

    async parse() {
        while (!this.paused) {
            console.log(`Checking ${this.gamesQueueName} queue for game to process...`);

            const queueItem = await this.getQueuedGame();
            const source = await this.gameSourceService.find(queueItem.sourceName);
            const game = await this.gameService.find(queueItem.name);

            if (source.contentSelectors) {
                for (const s in source.contentSelectors) {
                    const name = s;
                    const selector = object[s];

                    let siteUrl = 'farts';
                }
            }
        }
    }

    async _parseSite(site, page = null) {
        // Get all the links
        let siteUrl = encodeURIComponent(site.url);
        if (page != null) {
            siteUrl = encodeURIComponent(url.resolve(site.url, page));
        }
        const linkSelector = encodeURIComponent(site.linkSelector);
        const response = await axios.get(`${this.scraperBaseUrl}scrape/link?url=${siteUrl}&selector=${linkSelector}`);
        for (const a of response.data) {
            console.log(`Found link: ${a.content} (${a.link})`);
            let entity;
            try {
                await this.gameService.upsert(a.content, site.name, a.link);
                entity = await this.gameService.find(a.content);
            } catch (err) {
                console.error(chalk.red(`Error updating DB record for ${a.content}`));
            }

            try {
                if (entity) {
                    const ch = await this.queue.connect();
                    const hasQ = await ch.assertQueue(this.gamesQueueName);
                    if (hasQ) {
                        console.log(`Sending to queue: ${entity.name}`);
                        ch.sendToQueue(this.gamesQueueName, Buffer.from(JSON.stringify(entity)));
                    }
                }
            } catch (err) {
                console.error(chalk.red(`Error sending to queue for ${entity.name}`));
            }
        }

        // Get the next page link and parse if exists
        const nextPageSelector = encodeURIComponent(site.nextPageSelector);
        const nextPageResponse = await axios.get(`${this.scraperBaseUrl}scrape/link?url=${siteUrl}&selector=${nextPageSelector}`);
        if (nextPageResponse.data && !!nextPageResponse.data.length) {
            if (!this.paused) {
                console.log(`Navigating to ${nextPageResponse.data[0].link}`);
                await this._parseSite(site, nextPageResponse.data[0].link);
            }
        }
    }
}
