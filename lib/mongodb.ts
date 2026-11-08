import mongoose from 'mongoose'

type MongooseCache = {
  connection: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

const globalWithMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache
}

const cached = (globalWithMongoose.mongooseCache ??= {
  connection: null,
  promise: null,
})

export async function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI?.trim()
  if (!uri) {
    throw new Error('MongoDB is not configured. Set MONGODB_URI in .env.local.')
  }

  if (cached.connection && mongoose.connection.readyState === 1) {
    return cached.connection
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri)
      .then((connection) => {
        cached.connection = connection
        return connection
      })
      .catch((error: unknown) => {
        // Allow a later request to retry after a transient or configuration failure.
        cached.connection = null
        throw error
      })
      .finally(() => {
        // Do not retain a resolved promise; a later disconnected call must reconnect.
        cached.promise = null
      })
  }

  return cached.promise
}
