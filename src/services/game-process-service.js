import axios from 'axios';
import chalk from 'chalk';
import robotsParser from 'robots-txt-parser';
import ip from 'ip';
import moment from 'moment';

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
        this.robots = robotsParser({
            userAgent: 'Googlebot',
            allowOnNeutral: false
        });
    }

    async process() {
        console.log(`Checking ${this.gamesQueueName} queue for game to process...`);
        try {
            await this.getQueuedGame();
        } catch (err) {
            console.error('Error occurred connecting to queue, retrying in 60 seconds...', err);
            setTimeout(process, 60 * 1000);
        }
    }

    async getQueuedGame() {
        const ch = await this.queue.connect();
        const hasQ = await ch.assertQueue(this.gamesQueueName);
        if (hasQ) {
            await ch.consume(this.gamesQueueName, async msg => {
                if (msg !== null) {
                    console.log(msg.content.toString());
                    try {
                        await this.fetchGameContent(JSON.parse(msg.content));
                    } catch (err) {
                        console.error(`Error fetching game content for ${msg.content.name}`, err);
                    }

                    ch.ack(msg);
                }
            });
        }
    }

    async fetchGameContent(queueItem) {
        const source = await this.gameSourceService.find(queueItem.sourceName);
        const game = await this.gameService.find(queueItem.name);

        if (source && game) {
            let response = null;
            try {
                const allSelectors = [];
                if (source.contentSelectors) {
                    const selectorNames = Object.keys(source.contentSelectors);
                    allSelectors.push(
                        ...selectorNames.map(x => ({
                            name: x,
                            type: 'text',
                            selector: source.contentSelectors[x]
                        }))
                    );
                }
                if (source.htmlContentSelectors) {
                    const selectorNames = Object.keys(source.htmlContentSelectors);
                    allSelectors.push(
                        ...selectorNames.map(x => ({
                            name: x,
                            type: 'html',
                            selector: source.htmlContentSelectors[x]
                        }))
                    );
                }
                if (allSelectors.length) {
                    response = await this._scrape(source, game, allSelectors);
                }
            } catch (err) {
                console.error(chalk.red(`Error occured while fetching selectors for '${game.name}'`, err));
                return;
            }

            if (response && response.data && Array.isArray(response.data)) {
                try {
                    const dynamicProperties = {};
                    for (const d of response.data) {
                        let value = d.results[0].content;
                        if (source.postProcessors) {
                            const func = source.postProcessors[d.name];
                            if (func) {
                                value = eval(func)(value);
                            }
                        }

                        dynamicProperties[d.name] = value;
                    }
                    await this.gameService.upsertMultiple(game.name, dynamicProperties);
                    console.log(chalk.green(`Updated DB for '${game.name}: ${JSON.stringify(dynamicProperties)}`));
                } catch (err) {
                    console.error(chalk.red(`Error updating DB record for ${response.content}`, err));
                    return;
                }
            }
        }
    }

    async _scrape(source, game, selectors) {
        const siteOrigin = new URL(source.url).origin;
        const gamePageUrl = new URL(game.link, siteOrigin);
        const robotUrl = new URL('robots.txt', siteOrigin);
        console.log(`Parsing robots file for ${robotUrl}`);
        await this.robots.useRobotsFor(robotUrl.href);
        const canCrawl = await this.robots.canCrawl(gamePageUrl.href);
        console.log(`Can crawl ${gamePageUrl}? ${canCrawl}`);

        if (!canCrawl) {
            return Promise.reject(`Not allowed to crawl ${gamePageUrl}`);
        }

        let timeout = 0;

        // Get wait value to adhere to crawl delay
        const crawlDelay = await this.robots.getCrawlDelay();
        console.log(`Crawl delay for ${gamePageUrl}: ${crawlDelay} seconds`);
        if (source.lastPolled) {
            const lastPoll = moment(source.lastPolled[ip.address()]);
            if (lastPoll) {
                const timeSinceLastPoll = moment.duration(moment().diff(lastPoll)).seconds();
                if (timeSinceLastPoll < crawlDelay) {
                    timeout = (crawlDelay - timeSinceLastPoll) * 1000;
                }
            }
        }

        if (timeout) {
            console.log(`Waiting ${timeout} ms before attempting next parse`);
        }

        return new Promise((res, rej) => {
            setTimeout(
                async (u, s) => {
                    try {
                        console.log(chalk.green(`Fetching selectors for '${game.name}' from ${u}. Selectors: ${JSON.stringify(s)})}`));
                        const result = await axios.post(`${this.scraperBaseUrl}scrape`, {
                            url: u,
                            selectors: s
                        });
                        this.gameSourceService.logLastPolled(source.name, ip.address());
                        res(result);
                    } catch (err) {
                        rej(err);
                    }
                },
                timeout,
                gamePageUrl,
                selectors
            );
        });
    }
}
