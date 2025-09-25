// src/utils/sendPushNotification.js
const axios = require("axios");

/**
 * Mengirim push notification menggunakan OneSignal REST API.
 * @param {string[]} playerIds - Array berisi OneSignal Player ID (deviceTokens).
 * @param {string} heading - Judul notifikasi.
 * @param {string} content - Isi atau pesan notifikasi.
 * @param {object} [data] - Data tambahan yang ingin dikirim bersama notifikasi.
 */
const sendPushNotification = async (playerIds, heading, content, data = {}) => {
  // Jangan kirim jika tidak ada target atau kredensial tidak disetel
  if (
    !playerIds ||
    playerIds.length === 0 ||
    !process.env.ONESIGNAL_APP_ID ||
    !process.env.ONESIGNAL_REST_API_KEY
  ) {
    console.log(
      "Push notification dilewati: Player ID kosong atau kredensial OneSignal tidak ada."
    );
    return;
  }

  const notification = {
    app_id: process.env.ONESIGNAL_APP_ID,
    include_player_ids: playerIds,
    headings: { en: heading },
    contents: { en: content },
    data: data, // Data tambahan untuk navigasi di aplikasi Flutter
  };

  try {
    await axios.post(
      "https://onesignal.com/api/v1/notifications",
      notification,
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
        },
      }
    );
    console.log("Push notification berhasil dikirim ke OneSignal.");
  } catch (error) {
    // Tangani error dari OneSignal API
    if (error.response) {
      console.error(
        "Error sending OneSignal notification:",
        error.response.data
      );
    } else {
      console.error("Error sending OneSignal notification:", error.message);
    }
  }
};

module.exports = sendPushNotification;
