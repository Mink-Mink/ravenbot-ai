import { CommandInteraction, Interaction } from "discord.js";
import { oauth, patreon } from "patreon";

import { SlashCommand } from "./typing";
import config from "../../config/config.json";
import express from "express";
import url from "url";

const app = express();
var redirectURL = "http://writerbot.selkiemyth.com/";
const loginUrl = url.format({
  protocol: "https",
  host: "patreon.com",
  pathname: "/oauth2/authorize",
  query: {
    response_type: "code",
    client_id: config.CLIENT_ID,
    redirect_uri: redirectURL,
    state: "chill",
  },
});
const database = {};
app.get("/", (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.send("error loading patreon bot");
  }
  let token;

  return oauth
    .getTokens(code, redirectURL)
    .then(({ access_token }) => {
      token = access_token; // eslint-disable-line camelcase
      const apiClient = patreon(token);
      return apiClient("/current_user");
    })
    .then(({ store, rawJson }) => {
      const { id } = rawJson.data;
      database[id] = { ...rawJson.data, token };
      console.log(
        `Saved user ${store.find("user", id).full_name} to the database`
      );
      return res.redirect(`/protected/${id}`);
    })
    .catch((err) => {
      console.log(err);
    });
});
const server = app.listen(config.port, () => {
  const { port } = server.address();
  console.log(`Listening on http:/localhost:${port}`);
});

export const patreonCommand: SlashCommand = {
  skipDeferReply: true,

  slashCommand: async (client, interaction: CommandInteraction) => {
    interaction.reply({
      ephemeral: true,
      content: loginUrl,
    });
  },
  contextCommand: async (interaction) => {
    return;
  },
  modalSubmit: async (interaction) => {
    return;
  },
  commandSchema: {
    name: "patreondata",
    description: "get your patreon data",
  },
};