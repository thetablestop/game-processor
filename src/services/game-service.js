export class GameService {
    constructor({ mongodbProvider }) {
        this.mongodbProvider = mongodbProvider;
        this.collectionName = 'games';
    }

    async find(name) {
        const dbo = await this.mongodbProvider.connect();
        const collection = dbo.collection(this.collectionName);
        return await collection.findOne({ name: name });
    }

    async upsert(name, sourceName, link) {
        const dbo = await this.mongodbProvider.connect();
        const collection = dbo.collection(this.collectionName);
        return collection.findOneAndUpdate(
            {
                name: name
            },
            {
                $set: {
                    name: name,
                    link: link,
                    sourceName: sourceName
                }
            },
            {
                returnOriginal: false,
                sort: [['name', 1]],
                upsert: true
            }
        );
    }
}
