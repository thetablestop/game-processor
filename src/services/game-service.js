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

    async upsert(name, propertyName, propertyValue) {
        const dbo = await this.mongodbProvider.connect();
        const collection = dbo.collection(this.collectionName);

        const dynamicProperty = {};
        dynamicProperty[propertyName] = propertyValue;

        return collection.findOneAndUpdate(
            {
                name: name
            },
            {
                $set: dynamicProperty
            },
            {
                returnOriginal: false,
                sort: [['name', 1]],
                upsert: true
            }
        );
    }

    async upsertMultiple(name, properties) {
        const dbo = await this.mongodbProvider.connect();
        const collection = dbo.collection(this.collectionName);

        return collection.findOneAndUpdate(
            {
                name: name
            },
            {
                $set: properties
            },
            {
                returnOriginal: false,
                sort: [['name', 1]],
                upsert: true
            }
        );
    }
}
