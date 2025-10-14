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
  // Log untuk debugging
  console.log("=== SEND PUSH NOTIFICATION ===");
  console.log("Player IDs:", playerIds);
  console.log("Heading:", heading);
  console.log("Content:", content);
  console.log("Data:", data);

  // Validasi kredensial OneSignal
  if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
    console.error(
      "❌ ONESIGNAL_APP_ID atau ONESIGNAL_REST_API_KEY tidak disetel!"
    );
    console.error(
      "ONESIGNAL_APP_ID:",
      process.env.ONESIGNAL_APP_ID ? "Ada" : "Tidak ada"
    );
    console.error(
      "ONESIGNAL_REST_API_KEY:",
      process.env.ONESIGNAL_REST_API_KEY ? "Ada" : "Tidak ada"
    );
    return;
  }

  // Validasi player IDs
  if (!playerIds || playerIds.length === 0) {
    console.log("⚠️ Push notification dilewati: Player ID kosong");
    return;
  }

  // Filter player IDs yang valid (tidak null, undefined, atau string kosong)
  const validPlayerIds = playerIds.filter((id) => id && id.trim() !== "");

  if (validPlayerIds.length === 0) {
    console.log(
      "⚠️ Push notification dilewati: Tidak ada Player ID yang valid"
    );
    return;
  }

  console.log("✅ Valid Player IDs:", validPlayerIds);

  const notification = {
    app_id: process.env.ONESIGNAL_APP_ID,
    include_player_ids: validPlayerIds,
    headings: { en: heading },
    contents: { en: content },
    data: data,
  };

  try {
    const response = await axios.post(
      "https://onesignal.com/api/v1/notifications",
      notification,
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
        },
      }
    );

    console.log("✅ Push notification berhasil dikirim ke OneSignal");
    console.log("Response:", {
      id: response.data.id,
      recipients: response.data.recipients,
      errors: response.data.errors,
    });

    // Log jika ada error dari OneSignal
    if (response.data.errors && response.data.errors.length > 0) {
      console.error("⚠️ OneSignal melaporkan errors:", response.data.errors);
    }
  } catch (error) {
    console.error("❌ Error sending OneSignal notification:");

    if (error.response) {
      // Error dari OneSignal API
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // Request dibuat tapi tidak ada response
      console.error("No response received from OneSignal");
      console.error("Request:", error.request);
    } else {
      // Error lain
      console.error("Error message:", error.message);
    }
  }
};

module.exports = sendPushNotification;
