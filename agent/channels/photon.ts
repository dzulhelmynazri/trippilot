import { defaultPhotonAuth, photonIMessageChannel } from "eve/channels/photon";

export default photonIMessageChannel({
  async credentials() {
    const projectId = process.env.IMESSAGE_PROJECT_ID!;
    const projectSecret = process.env.IMESSAGE_PROJECT_SECRET!;
    
    return { projectId, projectSecret };
  },

  webhookSecret: process.env.IMESSAGE_WEBHOOK_SECRET,

  onMessage(_ctx, message) {
    if (message.author.isBot) return null;
    return {
      auth: defaultPhotonAuth(message),
      context: [`The sender is ${message.author.fullName}.`],
    };
  },
});