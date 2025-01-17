import * as WomboDreamApi from "wombo-dream-api";

import {
  MessageActionRow,
  MessageAttachment,
  MessageContextMenuInteraction,
  Modal,
  TextInputComponent,
} from "discord.js";
import {
  downloadToBuffer,
  wombo,
} from "../../charaterBuilders/imageGenerators/wombo";

import { SlashCommand } from "./typing";
import sharp from "sharp";

export const remixwithwombo: SlashCommand = {
  slashCommand: async (client, interaction) => {
    return;
  },
  commandSchema: {
    name: "remixwithwombo",
    type: 3,
  },

  contextCommand: async (client, interaction:MessageContextMenuInteraction) => {
    const attachmentUrls: string[] = [];
    for (const attachment of interaction.targetMessage.attachments.values()) {
      attachmentUrls.push(attachment?.url ?? "");
    }
    for (const embed of interaction.targetMessage.embeds.values()) {
      attachmentUrls.push(embed.image?.url ?? "");
    }

    if (attachmentUrls.length == 0 || attachmentUrls[0] == "") {
      return await interaction.reply({
        content: "No image found!",
        ephemeral: true,
      });
    }

    const imageUrl = new TextInputComponent()
      .setCustomId("imageUrl")
      .setLabel("What is the image url?")
      .setStyle("SHORT")
      .setValue(attachmentUrls[0]);

    //get value of prompt
    const content = interaction.targetMessage.content?.length
      ? interaction.targetMessage.content
      : interaction.channel.messages
          .fetch(interaction.targetMessage.id)
          .then(async (message) => {
            console.log(message.content);
            return message.content.length
              ? message.content
              : message.embeds?.[0]?.title?.length
              ? message.embeds[0].title
              : message.reference?.messageId
              ? await interaction.channel.messages
                  .fetch(message.reference?.messageId)
                  .then((m) => {
                    return m.content.length
                      ? m.content
                      : m.embeds?.[0]?.title?.length
                      ? m.embeds[0].title
                      : m.reference?.messageId
                      ? interaction.channel.messages
                          .fetch(m.reference?.messageId)
                          .then((m) => {
                            return m.content ?? "";
                          })
                      : "";
                  })
              : "";
          });

    const prompt = new TextInputComponent()
      .setCustomId("prompt")
      .setLabel("What is the prompt for the image?")
      .setStyle("SHORT")
      .setValue(await content);

    const informationValueRow5: MessageActionRow<TextInputComponent> =
      new MessageActionRow<TextInputComponent>().addComponents(
        imageUrl
      ) as any as MessageActionRow<TextInputComponent>;

    const informationValueRow4: MessageActionRow<TextInputComponent> =
      new MessageActionRow<TextInputComponent>().addComponents(
        prompt
      ) as any as MessageActionRow<TextInputComponent>;
    const modal = new Modal()
      .setCustomId("remixwithwombo")
      .setTitle("remix with wombo");

    const style = new TextInputComponent()
      .setCustomId("style")
      .setLabel("What style? use /styles to view options")
      .setStyle("SHORT")
      .setValue("32");

    const level = new TextInputComponent()
      .setCustomId("level")
      .setLabel("HIGH|MEDIUM|LOW, What level?")
      .setStyle("SHORT")
      .setValue("MEDIUM");

    const informationValueRow: MessageActionRow<TextInputComponent> =
      new MessageActionRow<TextInputComponent>().addComponents(
        style
      ) as any as MessageActionRow<TextInputComponent>;

    const informationValueRow2: MessageActionRow<TextInputComponent> =
      new MessageActionRow<TextInputComponent>().addComponents(
        level
      ) as any as MessageActionRow<TextInputComponent>;

    modal.addComponents(
      informationValueRow,
      informationValueRow2,
      informationValueRow4,
      informationValueRow5
    );

    await interaction.showModal(modal);
  },
  modalSubmit: async (client, interaction) => {
    const imageUrl = interaction.fields.getTextInputValue("imageUrl");
    const prompt = interaction.fields.getTextInputValue("prompt");
    const style = interaction.fields.getTextInputValue("style");
    const level = interaction.fields.getTextInputValue("level");
    if (!["HIGH", "MEDIUM", "LOW"].includes(level)) {
      await interaction.editReply("level must be one of HIGH, MEDIUM, LOW");
      return;
    }
    if (
      await WomboDreamApi.buildDefaultInstance()
        .fetchStyles()
        .then((styles) => !styles.map((s: any) => `${s.id}`).includes(style))
    ) {
      await interaction.editReply("style must be one of the valid styles");
      return;
    }

    const buffers = await wombo(
      interaction,
      prompt,
      level as "HIGH" | "MEDIUM" | "LOW",
      parseInt(style),
      await sharp(await downloadToBuffer(imageUrl))
        .jpeg()
        .toBuffer()
    );
    await interaction.editReply({
      content: prompt,
      files: buffers.map(
        (buffer, index) =>
          new MessageAttachment(buffer, `generation${index}.jpeg`)
      ),
    });
  },
};
