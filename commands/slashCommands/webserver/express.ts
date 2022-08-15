import config from "../../../config/config.json";
import express from "express";
import http from "http";
import https from "https";
import { readFileSync } from "fs";

export const app = express();

// Certificate for Domain 1
const privateKey1 = readFileSync(
  "/etc/letsencrypt/live/" + config.redirectUrl + "/privkey.pem",
  "utf8"
);
const certificate1 = readFileSync(
  "/etc/letsencrypt/live/" + config.redirectUrl + "/cert.pem",
  "utf8"
);
const ca1 = readFileSync(
  "/etc/letsencrypt/live/" + config.redirectUrl + "/chain.pem",
  "utf8"
);
const credentials1 = {
  key: privateKey1,
  cert: certificate1,
  ca: ca1,
};

// Certificate for Domain 3
// ... (just like line 22-29)
// Certificate for Domain 4
// ... (just like line 22-29)

// Starting both http & https servers
const httpServer = http.createServer(app);
const httpsServer = https.createServer(credentials1, app);

// httpsServer.addContext('<domain3.com>', credentials3); if you have the thrid domain.
// httpsServer.addContext('<domain4.com>', credentials4); if you have the fourth domain.

//..
export const start = async () => {
  httpServer.listen(80, () => {
    console.log("HTTP Server running on port 80");
  });
  httpsServer.listen(443, () => {
    console.log("HTTPS Server running on port 443");
  });
};
