const axios = require("axios");

const { KEITH_BASE } = require('../config/apis');
const API = `${KEITH_BASE}/livescore`;

// Comprehensive Whitelist of All Top Global Leagues & Competitions
const TOP_LEAGUES = [
  // 🏆 UEFA European Club Competitions
  "champions league",
  "europa league",
  "conference league",
  "super cup",

  // 🇬🇧 England
  "premier league",
  "championship",
  "efl championship",
  "fa cup",
  "carabao cup",
  "efl cup",

  // 🇪🇸 Spain
  "la liga",
  "laliga",
  "copa del rey",

  // 🇮🇹 Italy
  "serie a",
  "coppa italia",

  // 🇩🇪 Germany
  "bundesliga",
  "dfb pokal",

  // 🇫🇷 France
  "ligue 1",
  "coupe de france",

  // 🇹🇷 Turkey (Galatasaray, Fenerbahçe, Beşiktaş)
  "super lig",
  "süper lig",
  "turkish super lig",

  // 🇳🇱 Netherlands & 🇵🇹 Portugal
  "eredivisie",
  "primeira liga",
  "liga portugal",

  // 🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland, 🇧🇪 Belgium, 🇬🇷 Greece, 🇨🇭 Switzerland, 🇦🇹 Austria, 🇩🇰 Denmark
  "scottish premiership",
  "belgian pro league",
  "jupiler pro league",
  "super league greece",
  "swiss super league",
  "austrian bundesliga",
  "superliga",

  // 🇸🇦 Saudi Arabia & 🇺🇸 Americas
  "saudi pro league",
  "mls",
  "major league soccer",
  "liga mx",
  "serie a brazil",
  "brasileirao",
  "liga profesional",
  "copa libertadores",
  "copa sudamericana",

  // 🌍 International & Continental Tournaments
  "world cup",
  "euros",
  "euro qualification",
  "copa america",
  "nations league",
  "afcon",
  "africa cup of nations",
  "afc champions league",
  "club world cup"
];

module.exports = {
  name: "livescore",
  description: "Shows current football live scores for top leagues worldwide.",

  async execute(sock, msg) {
    const jid = msg.key.remoteJid;

    const loading = await sock.sendMessage(
      jid,
      { text: "⚽ Fetching live matches..." },
      { quoted: msg }
    );

    try {
      const { data } = await axios.get(API);

      if (!data.status) {
        return sock.sendMessage(
          jid,
          {
            text: "❌ Failed to fetch live scores.",
            edit: loading.key
          }
        );
      }

      const allGames = Object.values(data.result.games);

      if (!allGames.length) {
        return sock.sendMessage(
          jid,
          {
            text: "📭 No matches found.",
            edit: loading.key
          }
        );
      }

      // Filter matches dynamically by checking league metadata
      const filteredGames = allGames.filter(game => {
        const leagueName = (game.L || game.league || game.sn || "").toLowerCase();
        const countryCategory = (game.cn || "").toLowerCase();
        const fullLeagueStr = `${countryCategory} ${leagueName}`.trim();

        return TOP_LEAGUES.some(topLeague => 
          fullLeagueStr.includes(topLeague) || leagueName.includes(topLeague)
        );
      });

      // Show filtered games if available, otherwise fall back to all games
      const gamesToShow = filteredGames.length > 0 ? filteredGames : allGames;

      let text = filteredGames.length > 0 
        ? "⚽ *LIVE SCORES (MAJOR LEAGUES)*\n\n" 
        : "⚽ *LIVE SCORES*\n\n";

      for (const game of gamesToShow.slice(0, 20)) {
        const status = game.R?.st || "NS";
        const home = game.p1;
        const away = game.p2;
        const score1 = game.R?.r1 ?? "0";
        const score2 = game.R?.r2 ?? "0";

        let emoji = "⏳";

        if (status === "FT") emoji = "✅";
        else if (status === "2T" || status === "1T") emoji = "🔴";

        text += `${emoji} *${home}* ${score1} - ${score2} *${away}*\n`;
        text += `⏱ ${status}\n\n`;
      }

      if (gamesToShow.length > 20) {
        text += `📄 Showing 20 of ${gamesToShow.length} matches.`;
      }

      await sock.sendMessage(jid, {
        text,
        edit: loading.key
      });

    } catch (err) {
      console.error(err);

      await sock.sendMessage(jid, {
        text: "❌ Failed to fetch live scores.",
        edit: loading.key
      });
    }
  }
};
