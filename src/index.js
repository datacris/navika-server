const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const typeDefs = require("./schema");
const resolvers = require("./resolvers");
const TrackAPI = require("./datasources/track-api");
const conectarDB = require("./config/db");
const jwt = require("jsonwebtoken");

conectarDB();

async function startApolloServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
  });

  const { url } = await startStandaloneServer(server, {
    context: async ({ req }) => {
      const token = req.headers["authorization"] || "";
      if (token) {
        try {
          const usuario = jwt.verify(token.replace('Bearer ', ''), process.env.TOKEN_SECRET);
          return {
            usuario,
          };
        } catch (error) {
          console.log("Error en context token ==> ", error);
        }
      }
      return {
        dataSources: {
          trackAPI: new TrackAPI(),
        },
      };
    },
    listen: {
      port: process.env.PORT || 4000,
    },
  });

  console.log(`
      🚀  Server is running
      📭  Query at ${url}
    `);
}

startApolloServer();
