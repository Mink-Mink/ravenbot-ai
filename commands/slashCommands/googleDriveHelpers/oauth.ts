import {
  CommandInteraction,
  MessageActionRow,
  MessageButton,
  MessageSelectMenu,
} from "discord.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { generateLoginButton, getPatreonData } from "../patreonHelpers/oauth";

import { GoogleAuth } from "google-auth-library";
import { app } from "../webserver/express";
import config from "../../../config/config.json";
import { google } from "googleapis";

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/drive"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const funcBuffer: {
  [key: string]: (code: string) => Promise<void>;
} = {};

const { client_secret, client_id, redirect_uris } = config.installed;
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

app.get("/googleoauth/", async (req, res) => {
  const { code, state } = req.query;
  if (!code) {
    return res.send("error loading patreon bot");
  }
  if (funcBuffer[state as any]) {
    await funcBuffer[state as any](code as string);
    res.send("all logged in! return to discord");
  } else {
    res.send("no pending found, error");
  }
});
// Load client secrets from a local file.

// }

export const storeToken = async (
  interaction: CommandInteraction,
  code: string
) => {
  if (!code) {
    throw new Error("No code provided");
  }

  await oAuth2Client.getToken(code).then((token) => {
    const googleinfo = JSON.parse(
      readFileSync("./googleconfig.json").toString()
    );
    googleinfo[interaction.user.id] = token.tokens;
    // Store the token to disk for later program executions
    writeFileSync("./googleconfig.json", JSON.stringify(googleinfo));
  });

  await interaction.editReply({
    content: "Successfully logged in!",
    components: [],
  });
};

export const listFolders = async (interaction: CommandInteraction) => {
  if (!existsSync("./googleconfig.json")) {
    writeFileSync("./googleconfig.json", JSON.stringify({}));
  }

  const credentials = JSON.parse(
    readFileSync("./googleconfig.json").toString()
  )[interaction.user.id];

  if (!credentials) {
    return await generateGoogleLoginButton(interaction);
  }

  const auth = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );
  auth.setCredentials(credentials);
  const service = google.drive({ version: "v3", auth });

  const files = await service.files
    .list({
      pageSize: 10,
      q: `mimeType = 'application/vnd.google-apps.folder'`,
      fields: "nextPageToken, files(id, name)",
    })
    .catch((err) => null);

  if (!files) {
    return await generateGoogleLoginButton(interaction);
  }
  files.data.files;

  if (!existsSync("./patreonConfig.json")) {
    writeFileSync("./patreonConfig.json", JSON.stringify({}));
  }
  const patreonInfo = JSON.parse(
    readFileSync("./patreonConfig.json").toString()
  )[interaction.user.id];
  if (!patreonInfo) {
    return await generateLoginButton(interaction);
  } else {
    const data = await getPatreonData(
      patreonInfo.token,
      "/current_user/campaigns"
    );

    const tiers = data.rawJson.included
      .filter((i) => i.type === "reward")
      .map((i) => ({
        label: i.attributes.title ?? i.attributes.description,
        value: i.id,
        description: i.attributes.description.slice(0, 95) + "...",
      }));
    const folders = files.data.files.map((file) => ({
      label: file.name,
      value: file.id,
    }));

    await interaction.reply({
      ephemeral: true,
      content: "Share a folder with a group of your patreons!",
      components: [
        new MessageActionRow().addComponents(
          new MessageSelectMenu()
            .addOptions(folders)
            .setCustomId("folderselect")
        ),
      ],
    });

    const collector = interaction.channel.createMessageComponentCollector({
      time: 15000,
      componentType: "SELECT_MENU",
    });
    const myPieces = { folder: "", tier: "" };

    collector.on("collect", async (i) => {
      if (i.user.id === interaction.user.id) {
        if (i.customId === "folderselect") {
          i.deferUpdate();
          myPieces.folder = i.values.join(",");
          await interaction.editReply({
            content: "Share a folder with a group of your patreons!",
            components: [
              new MessageActionRow().addComponents(
                new MessageSelectMenu()
                  .addOptions(folders)
                  .setCustomId("folderselect")
                  .setDisabled(true)
                  .setPlaceholder(
                    folders.find((f) => f.value == i.values.join(",")).label
                  )
              ),
              new MessageActionRow().addComponents(
                new MessageSelectMenu()
                  .addOptions(tiers)
                  .setCustomId("tierselect")
              ),
            ],
          });
        }
        if (i.customId === "tierselect") {
          i.deferUpdate();
          myPieces.tier = i.values.join(",");
          await interaction.editReply({
            content: "Share a folder with a group of your patreons!",
            components: [
              new MessageActionRow().addComponents(
                new MessageSelectMenu()
                  .addOptions(folders)
                  .setCustomId("folderselect")
                  .setDisabled(true)
                  .setPlaceholder(
                    folders.find((f) => f.value == myPieces.folder).label
                  )
              ),
              new MessageActionRow().addComponents(
                new MessageSelectMenu()
                  .addOptions(tiers)
                  .setCustomId("tierselect")
                  .setDisabled(true)
                  .setPlaceholder(
                    tiers.find((f) => f.value == i.values.join(",")).label
                  )
              ),
              new MessageActionRow().addComponents(
                new MessageButton()
                  .setLabel("Confirm Share")
                  .setCustomId("confirmshare")
                  .setStyle("PRIMARY")
              ),
            ],
          });

          const collector2 =
            interaction.channel.createMessageComponentCollector({
              time: 15000,
              componentType: "BUTTON",
            });
          collector2.on("collect", async (ii) => {
            ii.deferUpdate();
            if (ii.user.id === interaction.user.id) {
              if (ii.customId === "confirmshare") {
                await interaction.editReply({
                  content: "Sharing folder...",
                  components: [],
                });
                await shareFolder(interaction, myPieces.folder, myPieces.tier);
              }
            }
          });
        }
      } else {
        i.reply({ content: `These buttons aren't for you!`, ephemeral: true });
      }
    });

    collector.on("end", (collected) => {
      console.log(`Collected ${collected.size} interactions.`);
    });
  }
};

export const generateGoogleLoginButton = async (
  interaction: CommandInteraction
) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    redirect_uri: "https://" + config.redirectUrl + "/googleoauth/",
    scope: SCOPES,
    state: interaction.user.id,
  });

  const buttons = new MessageActionRow().addComponents(
    new MessageButton()
      .setLabel("Login To Google")
      .setURL(authUrl)
      .setStyle("LINK")
  );
  await interaction.reply({
    ephemeral: true,
    content: "Login to Google Drive!",
    components: [buttons],
  });

  funcBuffer[interaction.user.id] = async (code) => {
    await storeToken(interaction, code);
  };
};

const shareFolder = (interaction, folder, reward) => {};
