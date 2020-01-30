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
                    const selectorName = s;
                    const selector = object[s];

                    const siteOrigin = new URL(source.url).origin;
                    const gamePageUrl = new URL(`${siteOrigin}${game.link}`);

                    const scraperUrl = new URL(`${this.scraperBaseUrl}scrape/text`);
                    scraperUrl.searchParams.append('link', gamePageUrl.href, 'selector', selector);

                    const response = await axios.get(scraperUrl.href);

                    try {
                        await this.gameService.upsert(name, selectorName, response.content);
                    } catch (err) {
                        console.error(chalk.red(`Error updating DB record for ${response.content}`));
                    }
                }
            }
        }
    }
}
