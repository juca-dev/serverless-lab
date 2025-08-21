import fastify from "fastify";
import { handler as ApiHealthGET } from "../src/api/health/index-get";
import { handler as ApiTestGET } from "../src/api/test/index-get";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const app = fastify({});

app.addHook("preHandler", (req, res, next) => {
  res.header(
    "Access-Control-Allow-Methods",
    "GET,PUT,POST,DELETE,OPTIONS,PATCH"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "X-Requested-With, Content-type,Accept,X-Access-Ley,X-User-Id"
  );
  res.header("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.status(200).send();
  } else {
    next();
  }
});

// ### ROUTES
app.get("/health", async (req, res) => {
  const data = await ApiHealthGET(req);
  const { statusCode, body } = data;
  res.status(statusCode).send(body);
});
app.get("/test", async (req, res) => {
  const data = await ApiTestGET(req);
  const { statusCode, body } = data;
  res.status(statusCode).send(body);
});

app.listen({ port: PORT }, (err, address) => {
  if (err) {
    console.error("### ERR", err);
    throw err;
  }

  console.log(`running on ${address}`);
});
