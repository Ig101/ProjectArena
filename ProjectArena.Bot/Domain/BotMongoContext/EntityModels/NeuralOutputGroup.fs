namespace ProjectArena.Bot.Domain.BotMongoContext.EntityModels
open MongoDB.Bson.Serialization.Attributes;

type NeuralOutputGroup = {
    [<BsonElement("o")>]
    Output: string
    [<BsonElement("i")>]
    Inputs: NeuralBond seq
}