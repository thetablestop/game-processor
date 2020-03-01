export class GameSourcesService {
    constructor({ mongodbProvider }) {
        this.mongodbProvider = mongodbProvider;
        this.collectionName = 'sources';
    }

    async getAll() {
        const dbo = await this.mongodbProvider.connect();
        const collection = dbo.collection(this.collectionName);
        return await collection.find().toArray();
    }

    async find(name) {
        const dbo = await this.mongodbProvider.connect();
        const collection = dbo.collection(this.collectionName);
        return await collection.findOne({ name: name });
    }

    async insert(source) {
        const dbo = await this.mongodbProvider.connect();
        const collection = dbo.collection(this.collectionName);
        return await collection.insertOne(source);
    }

    async update(source) {
        const dbo = await this.mongodbProvider.connect();
        const collection = dbo.collection(this.collectionName);
        return await collection.updateOne({ name: source.name }, { $set: source });
    }

    async logLastPolled(sourceName, ip) {
        const dbo = await this.mongodbProvider.connect();
        const collection = dbo.collection(this.collectionName);
        const lastPolled = {};
        lastPolled[ip] = new Date().getTime();
        return await collection.updateOne({ name: sourceName }, { $set: { lastPolled: lastPolled } });
    }

    async delete(name) {
        const dbo = await this.mongodbProvider.connect();
        const collection = dbo.collection(this.collectionName);
        return await collection.findOneAndDelete({ name: name });
    }
}
