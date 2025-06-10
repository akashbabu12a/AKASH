const axios = require("axios");
const fs = require('fs');
 
const baseApiUrl = async () => {
  const base = await axios.get("https://raw.githubusercontent.com/Blankid018/D1PT0/main/baseApiUrl.json");
  return base.data.api;
};
 
module.exports = {
  config: {
    name: "video",
    version: "1.1.4",
    credits: "dipto", //fixed by Ullash 
    countDown: 5,
    hasPermssion: 0,
    description: "Download video, audio, and info from YouTube",
    category: "media",
    commandCategory: "media",
    usePrefix: true,
    prefix: true,
    usages:
      " {pn} [video|-v] [<video name>|<video link>]\n" +
      " {pn} [audio|-a] [<video name>|<video link>]\n" +
      " {pn} [info|-i] [<video name>|<video link>]\n" +
      "Example:\n" +
      "{pn} -v chipi chipi chapa chapa\n" +
      "{pn} -a chipi chipi chapa chapa\n" +
      "{pn} -i chipi chipi chapa chapa"
  },
 
  run: async ({ api, args, event }) => {
    const { threadID, messageID, senderID } = event;
 
    let action = args[0] ? args[0].toLowerCase() : '-v';
 
    if (!['-v', 'video', 'mp4', '-a', 'audio', 'mp3', '-i', 'info'].includes(action)) {
      args.unshift('-v');
      action = '-v';
    }
 
    const checkurl = /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))((\w|-){11})(?:\S+)?$/;
    const urlYtb = args[1] ? checkurl.test(args[1]) : false;
 
    if (urlYtb) {
      const format = ['-v', 'video', 'mp4'].includes(action) ? 'mp4'
        : ['-a', 'audio', 'mp3'].includes(action) ? 'mp3' : null;
 
      if (!format) return api.sendMessage('❌ Invalid format. Use -v for video or -a for audio.', threadID, messageID);
 
      try {
        const match = args[1].match(checkurl);
        const videoID = match ? match[1] : null;
        if (!videoID) return api.sendMessage('❌ Invalid YouTube link.', threadID, messageID);
 
        const path = `ytb_${format}_${videoID}.${format}`;
        const { data: { title, downloadLink, quality } } = await axios.get(`${await baseApiUrl()}/ytDl3?link=${videoID}&format=${format}&quality=3`);
 
        await api.sendMessage({
          body: `• Title: ${title}\n• Quality: ${quality}`,
          attachment: await downloadFile(downloadLink, path)
        }, threadID, () => fs.unlinkSync(path), messageID);
 
        return;
      } catch (e) {
        console.error(e);
        return api.sendMessage('❌ Failed to download. Please try again later.', threadID, messageID);
      }
    }
 
    args.shift(); 
    const keyWord = args.join(" ");
    if (!keyWord) return api.sendMessage('❌ Please provide a search keyword.', threadID, messageID);
 
    try {
      const searchResult = (await axios.get(`${await baseApiUrl()}/ytFullSearch?songName=${encodeURIComponent(keyWord)}`)).data.slice(0, 6);
      if (!searchResult.length) return api.sendMessage(`⭕ No results for keyword: ${keyWord}`, threadID, messageID);
 
      let msg = "";
      const thumbnails = [];
      let i = 1;
 
      for (const info of searchResult) {
        thumbnails.push(streamImage(info.thumbnail, `thumbnail_${i}.jpg`));
        msg += `${i++}. ${info.title}\nTime: ${info.time}\nChannel: ${info.channel.name}\n\n`;
      }
 
      api.sendMessage({
        body: msg + "👉 Reply to this message with a number to select.",
        attachment: await Promise.all(thumbnails)
      }, threadID, (err, info) => {
        if (err) return console.error(err);
        global.client.handleReply.push({
          name: module.exports.config.name,
          messageID: info.messageID,
          author: senderID,
          result: searchResult,
          action
        });
      }, messageID);
    } catch (err) {
      console.error(err);
      return api.sendMessage("❌ An error occurred while searching: " + err.message, threadID, messageID);
    }
  },
 
  handleReply: async ({ event, api, handleReply }) => {
    const { threadID, messageID, senderID, body } = event;
 
    if (senderID !== handleReply.author) return;
    const { result, action } = handleReply;
    const choice = parseInt(body);
 
    if (isNaN(choice) || choice <= 0 || choice > result.length)
      return api.sendMessage("❌ Invalid number. Please reply with a valid number.", threadID, messageID);
 
    const selectedVideo = result[choice - 1];
    const videoID = selectedVideo.id;
 
    try {
      await api.unsendMessage(handleReply.messageID);
    } catch (e) {
      console.error("Unsend failed:", e);
    }
 
    if (['-v', 'video', 'mp4', '-a', 'audio', 'mp3', 'music'].includes(action)) {
      const format = ['-v', 'video', 'mp4'].includes(action) ? 'mp4' : 'mp3';
      try {
        const path = `ytb_${format}_${videoID}.${format}`;
        const { data: { title, downloadLink, quality } } = await axios.get(`${await baseApiUrl()}/ytDl3?link=${videoID}&format=${format}&quality=3`);
 
        await api.sendMessage({
          body: `• Title: ${title}\n• Quality: ${quality}`,
          attachment: await downloadFile(downloadLink, path)
        }, threadID, () => fs.unlinkSync(path), messageID);
      } catch (e) {
        console.error(e);
        return api.sendMessage('❌ Failed to download. Please try again later.', threadID, messageID);
      }
    }
 
    if (action === '-i' || action === 'info') {
      try {
        const { data } = await axios.get(`${await baseApiUrl()}/ytfullinfo?videoID=${videoID}`);
        await api.sendMessage({
          body: `✨ Title: ${data.title}\n⏳ Duration: ${(data.duration / 60).toFixed(2)} mins\n📺 Resolution: ${data.resolution}\n👀 Views: ${data.view_count}\n👍 Likes: ${data.like_count}\n💬 Comments: ${data.comment_count}\n📂 Category: ${data.categories[0]}\n📢 Channel: ${data.channel}\n🧍 Uploader ID: ${data.uploader_id}\n👥 Subscribers: ${data.channel_follower_count}\n🔗 Channel URL: ${data.channel_url}\n🔗 Video URL: ${data.webpage_url}`,
          attachment: await streamImage(data.thumbnail, 'info_thumb.jpg')
        }, threadID, messageID);
      } catch (e) {
        console.error(e);
        return api.sendMessage('❌ Failed to retrieve video info.', threadID, messageID);
      }
    }
  }
};
 
async function downloadFile(url, pathName) {
  try {
    const res = await axios.get(url, { responseType: "arraybuffer" });
    fs.writeFileSync(pathName, Buffer.from(res.data));
    return fs.createReadStream(pathName);
  } catch (err) {
    throw err;
  }
}
 
async function streamImage(url, pathName) {
  try {
    const response = await axios.get(url, { responseType: "stream" });
    response.data.path = pathName;
    return response.data;
  } catch (err) {
    throw err;
  }
        }
