import axios from 'axios';
import chalk from 'chalk';

export class GameProcessService {
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

    async process() {
        while (!this.paused) {
            console.log(`Checking ${this.gamesQueueName} queue for game to process...`);
            await this.getQueuedGame();
        }
    }

    async getQueuedGame() {
        const ch = await this.queue.connect();
        const hasQ = await ch.assertQueue(this.gamesQueueName);
        if (hasQ) {
            await ch.consume(this.gamesQueueName, async msg => {
                if (msg !== null) {
                    console.log(msg.content.toString());

                    await this.fetchGameContent(JSON.parse(msg.content));

                    ch.ack(msg);
                }
            });
        }
    }

    async fetchGameContent(queueItem) {
        const source = await this.gameSourceService.find(queueItem.sourceName);
        const game = await this.gameService.find(queueItem.name);

        if (source.contentSelectors) {
            for (const s in source.contentSelectors) {
                const selectorName = s;
                const selector = source.contentSelectors[s];

                const siteOrigin = new URL(source.url).origin;
                const gamePageUrl = new URL(`${siteOrigin}${game.link}`);

                const scraperUrl = new URL(`${this.scraperBaseUrl}scrape/text`);
                scraperUrl.searchParams.append('url', gamePageUrl.href);
                scraperUrl.searchParams.append('selector', selector);

                let response = null;
                try {
                    console.log(chalk.green(`Fetching '${selectorName}' for '${game.name}' from ${gamePageUrl.href}`));
                    response = await axios.get(scraperUrl.href);
                    console.log(
                        chalk.green(`'${selectorName}' is '${response.data[0].content}' for '${game.name}' from ${gamePageUrl.href}`)
                    );
                } catch (err) {
                    console.error(
                        chalk.red(`Error occured while fetching '${selectorName}' for '${game.name}' from ${gamePageUrl.href}`, err)
                    );
                }

                if (response) {
                    try {
                        await this.gameService.upsert(game.name, selectorName, response.data[0].content);
                    } catch (err) {
                        console.error(chalk.red(`Error updating DB record for ${response.content}`));
                    }
                }
            }
        }
    }
}
